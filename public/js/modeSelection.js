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

    async showLocalCopySelection() {
        const localCopyContent = document.getElementById('localCopyContent');
        if (!localCopyContent) return;

        // Load favorites
        let favorites = [];
        try {
            const response = await fetch('/api/favorites');
            const data = await response.json();
            if (data.success) {
                favorites = data.favorites;
            }
        } catch (error) {
            console.error('Error loading favorites:', error);
        }

        localCopyContent.innerHTML = `
            <div style="padding: 2rem;">
                <p style="margin-bottom: 1.5rem; color: var(--text-secondary);">
                    Select the directory where your local copy of SeeStar files is located.
                </p>

                ${favorites.length > 0 ? `
                    <div style="margin-bottom: 2rem;">
                        <h3 style="font-size: 1rem; margin-bottom: 1rem; color: var(--text-secondary); display: flex; align-items: center; gap: 0.5rem;">
                            ⭐ Favorite Folders
                        </h3>
                        <div id="favoritesList" style="display: flex; flex-direction: column; gap: 0.75rem;">
                            ${favorites.map(fav => `
                                <div class="favorite-item" data-path="${fav.path}"
                                     style="display: flex; align-items: center; gap: 0.75rem; padding: 1rem;
                                            background: var(--bg-card); border: 2px solid var(--border-color);
                                            border-radius: 8px; cursor: pointer; transition: all 0.2s;">
                                    <span style="font-size: 1.5rem;">📁</span>
                                    <div style="flex: 1; min-width: 0;">
                                        <div style="font-weight: 600; margin-bottom: 0.25rem;">${fav.name}</div>
                                        <div style="font-size: 0.875rem; color: var(--text-secondary); font-family: monospace;
                                                    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${fav.path}</div>
                                    </div>
                                    <button class="remove-favorite-btn" data-path="${fav.path}"
                                            style="background: none; border: none; color: var(--text-secondary);
                                                   cursor: pointer; padding: 0.5rem; font-size: 1.25rem;
                                                   transition: color 0.2s;"
                                            title="Remove from favorites">✕</button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <div style="margin-bottom: 1.5rem;">
                    <label for="localPathInput" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">
                        Or Browse for a Folder:
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
                        <button class="btn btn-secondary" id="addFavoriteBtn" style="padding: 0.75rem 1.5rem;" disabled title="Add to favorites">
                            ⭐
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
        const addFavoriteBtn = document.getElementById('addFavoriteBtn');
        const pathInput = document.getElementById('localPathInput');

        // Favorite items click handlers
        const favoriteItems = document.querySelectorAll('.favorite-item');
        favoriteItems.forEach(item => {
            item.addEventListener('click', (e) => {
                // Don't trigger if clicking the remove button
                if (e.target.closest('.remove-favorite-btn')) return;

                const path = item.getAttribute('data-path');
                this.selectedPath = path;
                pathInput.value = path;
                proceedBtn.disabled = false;
                addFavoriteBtn.disabled = false;

                // Visual feedback
                favoriteItems.forEach(fi => {
                    fi.style.borderColor = 'var(--border-color)';
                    fi.style.background = 'var(--bg-card)';
                });
                item.style.borderColor = 'var(--primary-color)';
                item.style.background = 'var(--bg-secondary)';
            });

            // Hover effects
            item.addEventListener('mouseenter', function() {
                if (this.style.borderColor !== 'var(--primary-color)') {
                    this.style.background = 'var(--bg-secondary)';
                }
            });
            item.addEventListener('mouseleave', function() {
                if (this.style.borderColor !== 'var(--primary-color)') {
                    this.style.background = 'var(--bg-card)';
                }
            });
        });

        // Remove favorite buttons
        const removeFavBtns = document.querySelectorAll('.remove-favorite-btn');
        removeFavBtns.forEach(btn => {
            btn.addEventListener('mouseenter', function() {
                this.style.color = 'var(--danger-color)';
            });
            btn.addEventListener('mouseleave', function() {
                this.style.color = 'var(--text-secondary)';
            });
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const path = btn.getAttribute('data-path');
                await this.removeFavorite(path);
            });
        });

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
                    addFavoriteBtn.disabled = false;
                });
            });
        }

        if (addFavoriteBtn) {
            addFavoriteBtn.addEventListener('click', async () => {
                if (this.selectedPath) {
                    await this.addFavorite(this.selectedPath);
                }
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

    async addFavorite(path) {
        try {
            const pathName = path.split('\\').pop() || path;

            const response = await fetch('/api/favorites/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path, name: pathName })
            });

            const result = await response.json();

            if (result.success) {
                app.updateStatus('Added to favorites');
                // Refresh the local copy selection screen
                this.showLocalCopySelection();
            }
        } catch (error) {
            console.error('Error adding favorite:', error);
            app.showModal('Error', `<p>Failed to add favorite: ${error.message}</p>`, null, 'Close');
        }
    }

    async removeFavorite(path) {
        try {
            const response = await fetch('/api/favorites/remove', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path })
            });

            const result = await response.json();

            if (result.success) {
                app.updateStatus('Removed from favorites');
                // Refresh the local copy selection screen
                this.showLocalCopySelection();
            }
        } catch (error) {
            console.error('Error removing favorite:', error);
            app.showModal('Error', `<p>Failed to remove favorite: ${error.message}</p>`, null, 'Close');
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
        if (commonPaths && common && Array.isArray(common)) {
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
        if (browserList && drives && Array.isArray(drives)) {
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
            // Fix: Use 'directories' instead of 'items' and add null check
            const directories = data.directories || [];
            if (directories.length === 0) {
                browserList.innerHTML = `
                    <div style="padding: 2rem; text-align: center; color: var(--text-muted);">
                        No subdirectories found
                    </div>
                `;
            } else {
                browserList.innerHTML = directories.map(item => `
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
