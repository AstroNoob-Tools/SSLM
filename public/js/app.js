// SSLM - SeaStar Library Manager - Main Application
class App {
    constructor() {
        this.socket = null;
        this.currentScreen = 'welcome';
        this.config = null;

        this.init();
    }

    async init() {
        console.log('SSLM - SeaStar Library Manager - Initializing...');

        // Initialize Socket.IO connection
        this.initializeSocket();

        // Load configuration
        await this.loadConfig();

        // Setup event listeners
        this.setupEventListeners();

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
        // Settings button
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.showSettings());
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
        const modalCancel = document.getElementById('modalCancel');
        const modalConfirm = document.getElementById('modalConfirm');

        if (modal && modalTitle && modalBody && modalFooter && modalCancel && modalConfirm) {
            modalTitle.textContent = title;

            if (typeof body === 'string') {
                modalBody.innerHTML = body;
            } else {
                modalBody.innerHTML = '';
                modalBody.appendChild(body);
            }

            // Clear modal footer and restore only default buttons
            modalFooter.innerHTML = '';

            // Re-add Cancel button
            const newCancelBtn = modalCancel.cloneNode(true);
            modalFooter.appendChild(newCancelBtn);

            // Re-add Confirm button
            const newConfirmBtn = modalConfirm.cloneNode(true);
            newConfirmBtn.textContent = confirmText;
            modalFooter.appendChild(newConfirmBtn);

            // Add new event listener to confirm button
            if (confirmCallback) {
                newConfirmBtn.style.display = '';  // Ensure button is visible
                newConfirmBtn.addEventListener('click', () => {
                    confirmCallback();
                    this.hideModal();
                });
            } else {
                newConfirmBtn.style.display = 'none';
            }

            modal.classList.add('active');
        }
    }

    hideModal() {
        const modal = document.getElementById('modalContainer');
        if (modal) {
            modal.classList.remove('active');
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
