// SSLM - SeeStar Library Manager - Main Application
class App {
    constructor() {
        this.socket = null;
        this.currentScreen = 'welcome';
        this.config = null;

        this.init();
    }

    async init() {
        console.log('SSLM - SeeStar Library Manager - Initializing...');

        // Setup event listeners first so header buttons always work,
        // even if socket.io or config loading fails later.
        this.setupEventListeners();

        // Initialize Socket.IO connection
        try {
            this.initializeSocket();
        } catch (err) {
            console.error('Socket.IO initialization failed:', err);
        }

        // Load configuration
        await this.loadConfig();

        // Initialize UI
        this.updateModeIndicator();

        console.log('Application ready!');
    }

    initializeSocket() {
        this.socket = io();

        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.updateStatus('Connected');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.updateStatus('Disconnected');
        });

        this.socket.on('pong', (data) => {
            console.log('Pong received:', data);
        });

        // Test connection
        this.socket.emit('ping');
    }

    async loadConfig() {
        try {
            const response = await fetch('/api/config');
            this.config = await response.json();
            console.log('Config loaded:', this.config);
        } catch (error) {
            console.error('Failed to load config:', error);
            this.config = {
                mode: { online: false },
                preferences: { defaultImportStrategy: 'incremental' }
            };
        }
    }

    async saveConfig(updates) {
        try {
            const response = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            const result = await response.json();
            if (result.success) {
                this.config = result.config;
                console.log('Config saved');
            }
        } catch (error) {
            console.error('Failed to save config:', error);
        }
    }

    setupEventListeners() {
        // Dashboard button
        const dashboardBtn = document.getElementById('dashboardBtn');
        if (dashboardBtn) {
            dashboardBtn.addEventListener('click', () => this.scrollToDashboardTop());
        }

        // Home button
        const homeBtn = document.getElementById('homeBtn');
        if (homeBtn) {
            homeBtn.addEventListener('click', () => this.goHome());
        }

        // Settings button
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.showSettings());
        }

        // About button
        const aboutBtn = document.getElementById('aboutBtn');
        if (aboutBtn) {
            aboutBtn.addEventListener('click', () => this.showAbout());
        }

        // Quit button
        const quitBtn = document.getElementById('quitBtn');
        if (quitBtn) {
            quitBtn.addEventListener('click', () => this.quit());
        }

        // Modal close
        const modalClose = document.getElementById('modalClose');
        const modalCancel = document.getElementById('modalCancel');

        if (modalClose) {
            modalClose.addEventListener('click', () => this.hideModal());
        }
        if (modalCancel) {
            modalCancel.addEventListener('click', () => this.hideModal());
        }

        // Click outside modal to close
        const modalContainer = document.getElementById('modalContainer');
        if (modalContainer) {
            modalContainer.addEventListener('click', (e) => {
                if (e.target === modalContainer) {
                    this.hideModal();
                }
            });
        }
    }

    // Screen Management
    showScreen(screenId) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });

        // Show target screen
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
            this.currentScreen = screenId.replace('Screen', '');
            console.log('Switched to screen:', screenId);
        } else {
            console.error('Screen not found:', screenId);
        }
    }

    // Loading Overlay
    showLoading(message = 'Loading...') {
        const overlay = document.getElementById('loadingOverlay');
        const text = document.getElementById('loadingText');

        if (overlay && text) {
            text.textContent = message;
            overlay.classList.add('active');
        }
    }

    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.remove('active');
        }
    }

    // Modal
    showModal(title, body, confirmCallback = null, confirmText = 'Confirm') {
        const modal = document.getElementById('modalContainer');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        const modalFooter = document.getElementById('modalFooter');

        if (!modal || !modalTitle || !modalBody || !modalFooter) return;

        modalTitle.textContent = title;

        if (typeof body === 'string') {
            modalBody.innerHTML = body;
        } else {
            modalBody.innerHTML = '';
            modalBody.appendChild(body);
        }

        // Always recreate both buttons from scratch so they always exist in the DOM
        // (cloneNode approach caused modalCancel to disappear after single-button mode,
        // making subsequent two-button modal calls silently fail)
        modalFooter.innerHTML = '';

        const newCancelBtn = document.createElement('button');
        newCancelBtn.className = 'btn btn-secondary';
        newCancelBtn.id = 'modalCancel';
        newCancelBtn.textContent = 'Cancel';

        const newConfirmBtn = document.createElement('button');
        newConfirmBtn.className = 'btn btn-primary';
        newConfirmBtn.id = 'modalConfirm';
        newConfirmBtn.textContent = confirmText;

        if (confirmCallback) {
            // Two-button mode: Cancel + Confirm
            newCancelBtn.addEventListener('click', () => this.hideModal());
            newConfirmBtn.addEventListener('click', () => {
                confirmCallback();
                this.hideModal();
            });
            modalFooter.appendChild(newCancelBtn);
        } else {
            // Single-button mode: hide cancel but keep it in DOM so next showModal call
            // can find it via getElementById without crashing
            newCancelBtn.style.display = 'none';
            newConfirmBtn.addEventListener('click', () => this.hideModal());
            modalFooter.appendChild(newCancelBtn);
        }

        modalFooter.appendChild(newConfirmBtn);
        modal.classList.add('active');
    }

    hideModal() {
        const modal = document.getElementById('modalContainer');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    // Navigation
    goHome() {
        // Return to welcome screen
        this.showScreen('welcomeScreen');
        this.currentDirectory = null;
        this.updateStatus('Ready');

        // Hide dashboard button when leaving dashboard
        const dashboardBtn = document.getElementById('dashboardBtn');
        if (dashboardBtn) {
            dashboardBtn.style.display = 'none';
        }
    }

    scrollToDashboardTop() {
        const objectDetailScreen = document.getElementById('objectDetailScreen');
        const sessionDetailScreen = document.getElementById('sessionDetailScreen');
        const dashboardScreen = document.getElementById('dashboardScreen');

        if (sessionDetailScreen && sessionDetailScreen.classList.contains('active')) {
            // We're viewing a session detail, navigate back to main dashboard
            this.showScreen('dashboardScreen');
            if (window.dashboard && window.dashboard.data) {
                window.dashboard.render();
            }
            window.scrollTo(0, 0);
        } else if (objectDetailScreen && objectDetailScreen.classList.contains('active')) {
            // We're viewing object details, navigate back to main dashboard
            this.showScreen('dashboardScreen');
            if (window.dashboard && window.dashboard.data) {
                window.dashboard.render();
            }
            window.scrollTo(0, 0);
        } else if (dashboardScreen && dashboardScreen.classList.contains('active')) {
            // We're on dashboard screen - check if viewing catalog detail or main dashboard
            const dashboardTop = document.getElementById('dashboard-top');

            if (!dashboardTop && window.dashboard && window.dashboard.data) {
                // We're viewing catalog detail, render main dashboard
                window.dashboard.render();
                window.scrollTo(0, 0);
            } else if (dashboardTop) {
                // We're on main dashboard, scroll to top
                const header = document.querySelector('.app-header');
                const headerHeight = header ? header.offsetHeight : 0;
                const offset = headerHeight + 20; // 20px extra padding

                const elementPosition = dashboardTop.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - offset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        }
    }

    // Settings Dialog
    showSettings() {
        const settingsHTML = `
            <div class="settings-panel">
                <div class="setting-item">
                    <label for="modeToggle">
                        <strong>Online Mode</strong>
                        <p style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.25rem;">
                            Enable additional features when internet is available
                        </p>
                    </label>
                    <div style="margin-top: 0.5rem;">
                        <input type="checkbox" id="modeToggle" ${this.config.mode.online ? 'checked' : ''}>
                        <label for="modeToggle">${this.config.mode.online ? 'Enabled' : 'Disabled'}</label>
                    </div>
                </div>
                <div class="setting-item" style="margin-top: 1.5rem;">
                    <strong>Default Import Strategy</strong>
                    <div style="margin-top: 0.5rem;">
                        <label style="display: block; margin-bottom: 0.5rem;">
                            <input type="radio" name="importStrategy" value="full"
                                ${this.config.preferences.defaultImportStrategy === 'full' ? 'checked' : ''}>
                            Copy Everything (Full Import)
                        </label>
                        <label style="display: block;">
                            <input type="radio" name="importStrategy" value="incremental"
                                ${this.config.preferences.defaultImportStrategy === 'incremental' ? 'checked' : ''}>
                            Incremental Copy (Only New/Changed)
                        </label>
                    </div>
                </div>
            </div>
        `;

        this.showModal('Settings', settingsHTML, () => {
            const modeToggle = document.getElementById('modeToggle');
            const importStrategy = document.querySelector('input[name="importStrategy"]:checked');

            if (modeToggle && importStrategy) {
                this.saveConfig({
                    mode: { online: modeToggle.checked },
                    preferences: { defaultImportStrategy: importStrategy.value }
                });
                this.updateModeIndicator();
            }
        }, 'Save Settings');
    }

    // About Dialog
    showAbout() {
        const version = this.config?.version || '—';
        const aboutHTML = `
            <div style="text-align: center; padding: 0.5rem 0 1rem;">
                <img src="/assets/astroNoobLogo.png" alt="AstroNoob" style="height: 80px; width: 80px; object-fit: contain; border-radius: 8px; margin-bottom: 0.75rem;">
                <h2 style="margin: 0 0 0.25rem; font-size: 1.4rem;">SSLM</h2>
                <p style="margin: 0 0 1.25rem; color: var(--text-secondary); font-size: 0.9rem;">
                    SeeStar Library Manager
                </p>
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;">
                    <tr>
                        <td style="padding: 0.5rem 1rem; color: var(--text-secondary); width: 40%;">Version</td>
                        <td style="padding: 0.5rem 1rem; font-weight: 600;">${version}</td>
                    </tr>
                    <tr style="background: rgba(255,255,255,0.03);">
                        <td style="padding: 0.5rem 1rem; color: var(--text-secondary);">Contact</td>
                        <td style="padding: 0.5rem 1rem;">
                            <a href="mailto:astronoob001@gmail.com"
                               style="color: var(--primary-color); text-decoration: none;">
                                astronoob001@gmail.com
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0.5rem 1rem; color: var(--text-secondary);">Purpose</td>
                        <td style="padding: 0.5rem 1rem;">Astrophotography library management for SeeStar devices</td>
                    </tr>
                </table>
            </div>
        `;
        this.showModal('About SSLM', aboutHTML, null, 'Close');
    }

    // Quit Application
    quit() {
        this.showModal(
            'Quit SSLM',
            '<p style="margin: 0.5rem 0;">Are you sure you want to quit? The server will shut down and the browser window will no longer work.</p>',
            async () => {
                try {
                    await fetch('/api/quit', { method: 'POST' });
                } catch (_) { /* server closed before response — expected */ }
                document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#aaa;font-size:1.2rem;">SSLM has shut down. You can close this tab.</div>';
            },
            'Quit'
        );
    }

    // UI Updates
    updateModeIndicator() {
        const indicator = document.getElementById('modeIndicator');
        const text = document.getElementById('modeText');

        if (indicator && text && this.config) {
            if (this.config.mode.online) {
                indicator.classList.add('online');
                text.textContent = 'Online';
            } else {
                indicator.classList.remove('online');
                text.textContent = 'Offline';
            }
        }
    }

    updateStatus(message) {
        const statusText = document.getElementById('statusText');
        if (statusText) {
            statusText.textContent = message;
        }
    }

    // Utility Methods
    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    formatTime(seconds) {
        if (seconds < 60) {
            return `${Math.round(seconds)}s`;
        } else if (seconds < 3600) {
            const mins = Math.floor(seconds / 60);
            const secs = Math.round(seconds % 60);
            return `${mins}m ${secs}s`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const mins = Math.floor((seconds % 3600) / 60);
            return `${hours}h ${mins}m`;
        }
    }
}

// Initialize app when DOM is ready
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new App();
});
