// Mode Selection Module

class ModeSelection {
    constructor() {
        this.selectedPath = null;
        this.currentBrowsePath = null;
        this.init();
    }

    init() {
        console.log('ModeSelection module loaded');

        // Mode selection button event listeners
        const importModeBtn = document.getElementById('importModeBtn');
        const localModeBtn = document.getElementById('localModeBtn');

        if (importModeBtn) {
            importModeBtn.addEventListener('click', () => this.selectImportMode());
        }

        if (localModeBtn) {
            localModeBtn.addEventListener('click', () => this.selectLocalMode());
        }
    }

    selectImportMode() {
        console.log('Import mode selected');
        app.updateStatus('Import mode selected');

        // Switch to import wizard screen
        app.showScreen('importWizardScreen');

        // TODO: Initialize import wizard (Phase 4)
    }

    selectLocalMode() {
        console.log('Local copy mode selected');
        app.updateStatus('Local copy mode selected');

        // Switch to local copy screen
        app.showScreen('localCopyScreen');

        this.showLocalCopySelection();
    }

    showLocalCopySelection() {
        const localCopyContent = document.getElementById('localCopyContent');
        if (!localCopyContent) return;

        localCopyContent.innerHTML = `
            <div style="padding: 2rem;">
                <p style="margin-bottom: 1.5rem; color: var(--text-secondary);">
                    Select the directory where your local copy of SeeStar files is located.
                </p>
                <div style="margin-bottom: 1.5rem;">
                    <label for="localPathInput" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">
                        Local Copy Path:
                    </label>
                    <div style="display: flex; gap: 0.5rem;">
                        <input type="text"
                               id="localPathInput"
                               readonly
                               placeholder="Click Browse to select a folder..."
                               style="flex: 1; padding: 0.75rem; border: 2px solid var(--border-color);
                                      background: var(--bg-tertiary); color: var(--text-primary);
                                      border-radius: 8px; font-size: 1rem;">
                        <button class="btn btn-secondary" id="browseLocalBtn" style="padding: 0.75rem 1.5rem;">
                            📁 Browse
                        </button>
                    </div>
                </div>
                <div style="display: flex; gap: 1rem;">
                    <button class="btn btn-secondary" id="backToWelcomeBtn">
                        ← Back
                    </button>
                    <button class="btn btn-primary" id="proceedLocalBtn" disabled>
                        Continue
                    </button>
                </div>
            </div>
        `;

        // Event listeners
        const backBtn = document.getElementById('backToWelcomeBtn');
        const proceedBtn = document.getElementById('proceedLocalBtn');
        const browseBtn = document.getElementById('browseLocalBtn');
        const pathInput = document.getElementById('localPathInput');

        if (backBtn) {
            backBtn.addEventListener('click', () => {
                app.showScreen('welcomeScreen');
            });
        }

        if (browseBtn) {
            browseBtn.addEventListener('click', () => {
                this.showFolderBrowser((selectedPath) => {
                    this.selectedPath = selectedPath;
                    pathInput.value = selectedPath;
                    proceedBtn.disabled = false;
                });
            });
        }

        if (proceedBtn) {
            proceedBtn.addEventListener('click', () => {
                if (this.selectedPath) {
                    this.proceedWithLocalPath(this.selectedPath);
                }
            });
        }
    }

    async showFolderBrowser(onSelect) {
        const modalBody = document.createElement('div');
        modalBody.innerHTML = `
            <div class="folder-browser">
                <div id="browserLoading" style="text-align: center; padding: 2rem;">
                    <div class="loading-spinner" style="margin: 0 auto 1rem; width: 40px; height: 40px;"></div>
                    <p>Loading drives...</p>
                </div>
                <div id="browserContent" style="display: none;">
                    <div style="margin-bottom: 1rem;">
                        <strong>Quick Access:</strong>
                        <div id="commonPaths" style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem;">
                        </div>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <strong>Current Path:</strong>
                        <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem; align-items: center;">
                            <button id="browserUpBtn" class="btn btn-secondary" style="padding: 0.5rem 1rem;">
                                ↑ Up
                            </button>
                            <input type="text" id="browserCurrentPath" readonly
                                   style="flex: 1; padding: 0.5rem; background: var(--bg-tertiary);
                                          border: 2px solid var(--border-color); border-radius: 8px;
                                          color: var(--text-primary);">
                        </div>
                    </div>
                    <div id="browserList" style="max-height: 300px; overflow-y: auto; border: 2px solid var(--border-color);
                                                  border-radius: 8px; background: var(--bg-tertiary);">
                    </div>
                </div>
            </div>
        `;

        app.showModal('Select Folder', modalBody, () => {
            if (this.currentBrowsePath) {
                onSelect(this.currentBrowsePath);
            }
        }, 'Select This Folder');

        // Load initial data
        await this.loadBrowserData();
    }

    async loadBrowserData(path = null) {
        try {
            if (!path) {
                // Load drives and common paths
                const response = await fetch('/api/browse/drives');
                const data = await response.json();

                if (data.success) {
                    this.renderDrivesAndCommon(data.drives, data.common);
                }
            } else {
                // Load directory contents
                const response = await fetch(`/api/browse/directory?path=${encodeURIComponent(path)}`);
                const data = await response.json();

                if (data.success) {
                    this.renderDirectoryContents(data);
                } else {
                    alert('Error: ' + (data.error || 'Cannot access directory'));
                }
            }
        } catch (error) {
            console.error('Browse error:', error);
            alert('Error loading directory: ' + error.message);
        }
    }

    renderDrivesAndCommon(drives, common) {
        const loading = document.getElementById('browserLoading');
        const content = document.getElementById('browserContent');
        const commonPaths = document.getElementById('commonPaths');
        const browserList = document.getElementById('browserList');
        const currentPathInput = document.getElementById('browserCurrentPath');

        if (loading) loading.style.display = 'none';
        if (content) content.style.display = 'block';
        if (currentPathInput) currentPathInput.value = 'Select a drive or location';

        // Render common paths
        if (commonPaths) {
            commonPaths.innerHTML = common.map(item => `
                <button class="btn btn-secondary" data-path="${item.path}" style="padding: 0.5rem 1rem; font-size: 0.875rem;">
                    ${item.name}
                </button>
            `).join('');

            commonPaths.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', () => {
                    const path = btn.getAttribute('data-path');
                    this.loadBrowserData(path);
                });
            });
        }

        // Render drives
        if (browserList) {
            browserList.innerHTML = drives.map(drive => `
                <div class="browser-item" data-path="${drive.path}" style="padding: 1rem; border-bottom: 1px solid var(--border-color);
                                                                            cursor: pointer; display: flex; align-items: center; gap: 0.5rem;">
                    <span style="font-size: 1.5rem;">💾</span>
                    <span><strong>${drive.name}</strong> Drive</span>
                </div>
            `).join('');

            browserList.querySelectorAll('.browser-item').forEach(item => {
                item.addEventListener('click', () => {
                    const path = item.getAttribute('data-path');
                    this.loadBrowserData(path);
                });
            });
        }

        // Setup up button (disabled for drives view)
        const upBtn = document.getElementById('browserUpBtn');
        if (upBtn) {
            upBtn.disabled = true;
        }

        this.currentBrowsePath = null;
    }

    renderDirectoryContents(data) {
        const browserList = document.getElementById('browserList');
        const currentPathInput = document.getElementById('browserCurrentPath');
        const upBtn = document.getElementById('browserUpBtn');

        this.currentBrowsePath = data.currentPath;

        if (currentPathInput) {
            currentPathInput.value = data.currentPath;
        }

        if (upBtn) {
            upBtn.disabled = false;
            upBtn.onclick = () => {
                if (data.parentPath && data.parentPath !== data.currentPath) {
                    this.loadBrowserData(data.parentPath);
                } else {
                    this.loadBrowserData(null); // Back to drives
                }
            };
        }

        if (browserList) {
            if (data.items.length === 0) {
                browserList.innerHTML = `
                    <div style="padding: 2rem; text-align: center; color: var(--text-muted);">
                        No subdirectories found
                    </div>
                `;
            } else {
                browserList.innerHTML = data.items.map(item => `
                    <div class="browser-item" data-path="${item.path}"
                         style="padding: 1rem; border-bottom: 1px solid var(--border-color);
                                cursor: pointer; display: flex; align-items: center; gap: 0.5rem;
                                transition: background 0.2s;">
                        <span style="font-size: 1.5rem;">📁</span>
                        <span>${item.name}</span>
                    </div>
                `).join('');

                // Add hover effects and click handlers
                browserList.querySelectorAll('.browser-item').forEach(item => {
                    item.addEventListener('mouseenter', function() {
                        this.style.background = 'var(--bg-secondary)';
                    });
                    item.addEventListener('mouseleave', function() {
                        this.style.background = 'transparent';
                    });
                    item.addEventListener('click', () => {
                        const path = item.getAttribute('data-path');
                        this.loadBrowserData(path);
                    });
                });
            }
        }
    }

    async proceedWithLocalPath(path) {
        console.log('Proceeding with local path:', path);

        app.showLoading('Analyzing directory...');

        try {
            // Call analysis API
            const response = await fetch(`/api/analyze?path=${encodeURIComponent(path)}`);
            const result = await response.json();

            app.hideLoading();

            if (result.success) {
                console.log('Analysis complete:', result);

                // Store analysis result globally
                window.analysisResult = result;

                // Show dashboard
                app.showScreen('dashboardScreen');

                // Initialize dashboard with results
                if (window.dashboard) {
                    window.dashboard.displayResults(result);
                }
            } else {
                app.showModal(
                    'Analysis Error',
                    `<p>Failed to analyze directory:</p><p style="color: var(--danger-color);">${result.error}</p>`,
                    null
                );
            }
        } catch (error) {
            app.hideLoading();
            app.showModal(
                'Error',
                `<p>An error occurred during analysis:</p><p style="color: var(--danger-color);">${error.message}</p>`,
                null
            );
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new ModeSelection();
});
