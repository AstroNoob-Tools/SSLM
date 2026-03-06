// SSLM - SeeStar Library Manager - Main Application

// Escape user-controlled strings before inserting into innerHTML (CWE-79)
function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
// Expose as global so other JS modules loaded in the same page can use it
window.escapeHtml = escapeHtml;

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

        // Make the mode badge in the header a live toggle
        const modeIndicator = document.getElementById('modeIndicator');
        if (modeIndicator) {
            modeIndicator.title = 'Click to toggle Online / Offline mode';
            modeIndicator.addEventListener('click', () => this.toggleOnlineMode());
        }

        // Warn user if a previous operation was interrupted (crash / power loss)
        this.checkInterruptedOperation();

        // Check for updates silently on startup
        this.checkForUpdates(true);

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

        // Buy Me a Coffee button
        const coffeeBtn = document.getElementById('coffeeBtn');
        if (coffeeBtn) {
            coffeeBtn.addEventListener('click', () => window.open('https://buymeacoffee.com/astro_noob', '_blank'));
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

        // Update badge
        const updateBadge = document.getElementById('updateBadge');
        const updateBadgeDismiss = document.getElementById('updateBadgeDismiss');
        if (updateBadge) {
            updateBadge.addEventListener('click', () => {
                if (this._updateInfo) this.showUpdateModal(this._updateInfo);
            });
        }
        if (updateBadgeDismiss) {
            updateBadgeDismiss.addEventListener('click', (e) => {
                e.stopPropagation();
                const badge = document.getElementById('updateBadge');
                if (badge) badge.style.display = 'none';
            });
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
            // Parse into a detached document — scripts never execute in DOMParser output.
            // Strip any <script> elements as defence-in-depth, then import safe nodes
            // into the live document. Never assigns untrusted content to live innerHTML.
            const doc = new DOMParser().parseFromString(body, 'text/html');
            doc.querySelectorAll('script').forEach(el => el.remove());
            const imported = Array.from(doc.body.childNodes).map(n => document.importNode(n, true));
            modalBody.replaceChildren(...imported);
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
                        <td style="padding: 0.5rem 1rem; font-weight: 600;">${escapeHtml(version)}</td>
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
                        <td style="padding: 0.5rem 1rem; color: var(--text-secondary);">Support</td>
                        <td style="padding: 0.5rem 1rem;">
                            <a href="https://buymeacoffee.com/astro_noob" target="_blank"
                               style="color: var(--text-secondary); text-decoration: none; font-size: 0.85rem;">
                                ☕ Buy me a coffee
                            </a>
                        </td>
                    </tr>
                    <tr style="background: rgba(255,255,255,0.03);">
                        <td style="padding: 0.5rem 1rem; color: var(--text-secondary);">Purpose</td>
                        <td style="padding: 0.5rem 1rem;">Astrophotography library management for SeeStar devices</td>
                    </tr>
                    <tr>
                        <td style="padding: 0.5rem 1rem; color: var(--text-secondary);">Updates</td>
                        <td style="padding: 0.5rem 1rem;">
                            <button id="checkUpdateBtn" class="btn btn-secondary"
                                style="padding: 0.3rem 0.8rem; font-size: 0.85rem;">
                                Check for Updates
                            </button>
                            <span id="checkUpdateResult" style="margin-left: 0.75rem; font-size: 0.85rem; color: var(--text-secondary);"></span>
                        </td>
                    </tr>
                </table>
            </div>
        `;
        this.showModal('About SSLM', aboutHTML, null, 'Close');

        // Wire up Check for Updates button after modal renders
        setTimeout(() => {
            const btn = document.getElementById('checkUpdateBtn');
            if (btn) {
                btn.addEventListener('click', async () => {
                    btn.disabled = true;
                    btn.textContent = 'Checking...';
                    const result = document.getElementById('checkUpdateResult');
                    const info = await this.checkForUpdates(false);
                    btn.disabled = false;
                    btn.textContent = 'Check for Updates';
                    if (info && info.hasUpdate) {
                        if (result) result.textContent = '';
                        this.hideModal();
                        this.showUpdateModal(info);
                    } else if (info && !info.hasUpdate && !info.error) {
                        if (result) {
                            result.textContent = `You're up to date (v${escapeHtml(info.currentVersion)})`;
                            result.style.color = 'var(--success-color)';
                        }
                    } else {
                        if (result) {
                            result.textContent = 'Check failed — are you online?';
                            result.style.color = 'var(--warning-color)';
                        }
                    }
                });
            }
        }, 0);
    }

    // ── Interrupted operation warning ─────────────────────────────────────────

    checkInterruptedOperation() {
        const op = this.config && this.config.interruptedOperation;
        if (!op) return;

        const typeLabel = { import: 'Import', merge: 'Merge', stackexport: 'Stack Export' }[op.type] || op.type;
        const dest = op.destinationPath || '';
        const started = op.startedAt ? new Date(op.startedAt).toLocaleString() : 'unknown time';

        const body = `<p style="margin-bottom:0.75rem;">A <strong>${escapeHtml(typeLabel)}</strong> operation that started at
            <strong>${escapeHtml(started)}</strong> did not finish cleanly (the app may have crashed or been closed).</p>
            ${dest ? `<p style="margin-bottom:0.75rem;">Destination: <code style="font-size:0.85em;">${escapeHtml(dest)}</code></p>` : ''}
            <p style="color:var(--warning-color);">The destination folder may contain incomplete files.
            We recommend verifying or re-running the operation before using the data.</p>`;

        this.showModal('Interrupted Operation Detected', body, null, null);
    }

    // ── Update methods ────────────────────────────────────────────────────────

    async checkForUpdates(silent = true) {
        try {
            const response = await fetch('/api/update/check');
            const info = await response.json();
            if (info.hasUpdate) {
                this._updateInfo = info;
                this.showUpdateNotification(info);
            }
            return info;
        } catch (err) {
            console.warn('Update check failed:', err.message);
            return null;
        }
    }

    showUpdateNotification(info) {
        this._updateInfo = info;
        const badge = document.getElementById('updateBadge');
        const text = document.getElementById('updateBadgeText');
        if (badge && text) {
            text.textContent = `Update available: v${info.latestVersion}`;
            badge.style.display = 'flex';
        }
    }

    showUpdateModal(info) {
        const hasAsset = !!info.downloadUrl;
        const modalBody = `
            <div style="padding: 0.5rem 0;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; margin-bottom: 1.25rem;">
                    <tr>
                        <td style="padding: 0.5rem 1rem; color: var(--text-secondary); width: 40%;">Current version</td>
                        <td style="padding: 0.5rem 1rem; font-weight: 600;">${escapeHtml('v' + info.currentVersion)}</td>
                    </tr>
                    <tr style="background: rgba(255,255,255,0.03);">
                        <td style="padding: 0.5rem 1rem; color: var(--text-secondary);">New version</td>
                        <td style="padding: 0.5rem 1rem; font-weight: 600; color: var(--success-color);">${escapeHtml('v' + info.latestVersion)} ✓</td>
                    </tr>
                    <tr>
                        <td style="padding: 0.5rem 1rem; color: var(--text-secondary);">Release notes</td>
                        <td style="padding: 0.5rem 1rem;">
                            <a id="releaseNotesLink" href="#" style="color: var(--primary-color); text-decoration: none; font-size: 0.85rem;">
                                View on GitHub →
                            </a>
                        </td>
                    </tr>
                </table>
                <div id="updateActionArea">
                    ${hasAsset
                        ? `<p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0 0 1rem;">
                               The installer will be downloaded and launched automatically. SSLM will close when installation begins.
                           </p>
                           <button id="downloadInstallBtn" class="btn btn-primary" style="width: 100%;">
                               Download &amp; Install
                           </button>`
                        : `<p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">
                               No installer asset found for this release. Visit GitHub to download manually.
                           </p>`
                    }
                </div>
            </div>
        `;

        this.showModal('Update Available', modalBody, null, 'Later');

        setTimeout(() => {
            const releaseLink = document.getElementById('releaseNotesLink');
            if (releaseLink) {
                releaseLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    fetch('/api/open-url', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: info.releaseUrl })
                    }).catch(() => {});
                });
            }

            const dlBtn = document.getElementById('downloadInstallBtn');
            if (dlBtn) {
                dlBtn.addEventListener('click', () => this.startUpdateDownload(info));
            }
        }, 0);
    }

    startUpdateDownload(info) {
        // Replace modal body with download progress UI
        const modalBody = document.getElementById('modalBody');
        const modalFooter = document.getElementById('modalFooter');
        if (!modalBody) return;

        modalBody.innerHTML = '';
        const progressHTML = `
            <div style="padding: 0.5rem 0;">
                <p style="font-size: 0.9rem; margin: 0 0 0.5rem; color: var(--text-secondary);">Downloading ${escapeHtml(info.fileName || 'installer')}…</p>
                <div class="progress-bar" style="margin-bottom: 0.5rem;">
                    <div class="progress-fill" id="updateProgressFill" style="width: 0%;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted);">
                    <span id="updateProgressBytes">0 MB / — MB</span>
                    <span id="updateProgressPct">0%</span>
                </div>
            </div>
        `;
        const doc = new DOMParser().parseFromString(progressHTML, 'text/html');
        doc.querySelectorAll('script').forEach(el => el.remove());
        modalBody.replaceChildren(...Array.from(doc.body.childNodes).map(n => document.importNode(n, true)));

        // Disable footer during download
        if (modalFooter) modalFooter.style.display = 'none';

        const onProgress = (data) => {
            const fill = document.getElementById('updateProgressFill');
            const bytes = document.getElementById('updateProgressBytes');
            const pct = document.getElementById('updateProgressPct');
            if (fill) fill.style.width = `${data.percent}%`;
            if (bytes) {
                const dl = this.formatBytes(data.bytesDownloaded);
                const total = data.totalBytes ? this.formatBytes(data.totalBytes) : '—';
                bytes.textContent = `${dl} / ${total}`;
            }
            if (pct) pct.textContent = `${data.percent}%`;
        };

        const onComplete = (data) => {
            this.socket.off('update:progress', onProgress);
            this.socket.off('update:complete', onComplete);
            this.socket.off('update:error', onError);
            this._showInstallReady(data.filePath);
        };

        const onError = (data) => {
            this.socket.off('update:progress', onProgress);
            this.socket.off('update:complete', onComplete);
            this.socket.off('update:error', onError);
            if (modalBody) {
                modalBody.innerHTML = '';
                const errP = document.createElement('p');
                errP.style.color = 'var(--danger-color)';
                errP.textContent = `Download failed: ${data.error}`;
                modalBody.appendChild(errP);
            }
            if (modalFooter) modalFooter.style.display = '';
        };

        this.socket.on('update:progress', onProgress);
        this.socket.on('update:complete', onComplete);
        this.socket.on('update:error', onError);

        fetch('/api/update/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                downloadUrl: info.downloadUrl,
                fileName: info.fileName,
                socketId: this.socket.id
            })
        }).catch(err => {
            this.socket.off('update:progress', onProgress);
            this.socket.off('update:complete', onComplete);
            this.socket.off('update:error', onError);
            if (modalBody) {
                modalBody.innerHTML = '';
                const errP = document.createElement('p');
                errP.style.color = 'var(--danger-color)';
                errP.textContent = `Download failed: ${err.message}`;
                modalBody.appendChild(errP);
            }
            if (modalFooter) modalFooter.style.display = '';
        });
    }

    _showInstallReady(filePath) {
        const modalBody = document.getElementById('modalBody');
        const modalFooter = document.getElementById('modalFooter');
        if (modalBody) {
            modalBody.innerHTML = '';
            const msg = document.createElement('div');
            msg.style.textAlign = 'center';
            msg.style.padding = '1rem 0';
            const p = document.createElement('p');
            p.style.color = 'var(--success-color)';
            p.style.marginBottom = '1rem';
            p.textContent = 'Download complete! Click Install Now to launch the installer. SSLM will close automatically.';
            const btn = document.createElement('button');
            btn.className = 'btn btn-primary';
            btn.style.width = '100%';
            btn.textContent = 'Install Now';
            btn.addEventListener('click', () => this.installUpdate(filePath));
            msg.appendChild(p);
            msg.appendChild(btn);
            modalBody.appendChild(msg);
        }
        if (modalFooter) modalFooter.style.display = 'none';
    }

    async installUpdate(filePath) {
        const modalBody = document.getElementById('modalBody');

        const showMsg = (text, color = 'var(--text-secondary)') => {
            if (!modalBody) return;
            modalBody.innerHTML = '';
            const p = document.createElement('p');
            p.style.textAlign = 'center';
            p.style.padding = '1rem 0';
            p.style.color = color;
            p.textContent = text;
            modalBody.appendChild(p);
        };

        showMsg('Launching installer… SSLM is closing.');

        try {
            const response = await fetch('/api/update/install', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath })
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                showMsg(`Install failed: ${data.error || response.statusText}`, 'var(--danger-color)');
            }
            // If OK, the server calls gracefulShutdown — page will become unresponsive shortly
        } catch (_) {
            // Network error means the server already closed — expected behaviour
        }
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

    async toggleOnlineMode() {
        this.config.mode.online = !this.config.mode.online;
        this.updateModeIndicator();
        await this.saveConfig({ mode: { online: this.config.mode.online } });

        // Refresh the object detail screen if it is currently visible
        if (this.currentScreen === 'objectDetail' && window.dashboard) {
            const obj = window.dashboard._currentSessionObj;
            const section = document.getElementById('object-aliases-section');
            if (this.config.mode.online) {
                // Went online — fetch aliases now
                if (obj) window.dashboard._loadObjectAliases(obj.name);
            } else {
                // Went offline — hide the aliases section and Rebrand button (preserve content)
                if (section) section.style.display = 'none';
                const rebrandDiv = document.getElementById('rebrand-action');
                if (rebrandDiv) rebrandDiv.style.display = 'none';
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
