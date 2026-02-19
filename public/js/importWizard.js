// Import Wizard Module
// Handles the 5-step import process from SeeStar device to local storage

class ImportWizard {
    constructor() {
        this.currentStep = 1;
        this.maxSteps = 5;
        this.selectedDevice = null;
        this.selectedStrategy = 'incremental';
        this.destinationPath = null;
        this.validationResult = null;
        this.currentBrowsePath = null;
        this.operationId = null;
        this.seestarDirectoryName = 'MyWorks'; // Default value

        this.init();
    }

    async init() {
        console.log('ImportWizard module loaded');
        await this.loadConfig();
        this.setupEventListeners();
        this.setupProgressListener();
        this.renderStep(1);
    }

    async loadConfig() {
        try {
            const response = await fetch('/api/config');
            const data = await response.json();
            if (data.seestar && data.seestar.directoryName) {
                this.seestarDirectoryName = data.seestar.directoryName;
                console.log('SeeStar directory name:', this.seestarDirectoryName);
            }
        } catch (error) {
            console.warn('Could not load config, using default:', error);
        }
    }

    setupEventListeners() {
        // Navigation buttons
        const backBtn = document.getElementById('wizardBackBtn');
        const nextBtn = document.getElementById('wizardNextBtn');

        if (backBtn) {
            backBtn.addEventListener('click', () => this.previousStep());
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.nextStep());
        }
    }

    setupProgressListener() {
        if (!app.socket) {
            console.warn('Socket.IO not available');
            return;
        }

        // Listen for import progress events
        app.socket.on('import:progress', (data) => {
            this.handleProgressUpdate(data);
        });

        app.socket.on('import:complete', (data) => {
            this.handleImportComplete(data);
        });

        app.socket.on('import:error', (data) => {
            this.handleImportError(data);
        });

        app.socket.on('import:cancelled', (data) => {
            this.handleImportCancelled(data);
        });

        // Listen for validation events
        app.socket.on('validate:progress', (data) => {
            this.handleValidationProgress(data);
        });

        app.socket.on('validate:complete', (data) => {
            this.handleValidationComplete(data);
        });

        app.socket.on('validate:error', (data) => {
            this.handleValidationError(data);
        });
    }

    async renderStep(stepNumber) {
        this.currentStep = stepNumber;
        this.updateStepIndicators();

        const content = document.getElementById('importWizardContent');
        if (!content) return;

        // Render the appropriate step
        switch (stepNumber) {
            case 1:
                await this.renderStep1_DeviceSelection();
                break;
            case 2:
                this.renderStep2_StrategySelection();
                break;
            case 3:
                await this.renderStep3_DestinationSelection();
                break;
            case 4:
                await this.renderStep4_Confirmation();
                break;
            case 5:
                this.renderStep5_Progress();
                break;
        }

        this.updateNavigationButtons();
    }

    updateStepIndicators() {
        const steps = document.querySelectorAll('.step');
        steps.forEach((step, index) => {
            const stepNum = index + 1;
            step.classList.remove('active', 'completed');

            if (stepNum < this.currentStep) {
                step.classList.add('completed');
            } else if (stepNum === this.currentStep) {
                step.classList.add('active');
            }
        });
    }

    updateNavigationButtons() {
        const backBtn = document.getElementById('wizardBackBtn');
        const nextBtn = document.getElementById('wizardNextBtn');

        if (backBtn) {
            // Hide back only during the active progress step (step 5)
            backBtn.style.display = this.currentStep === 5 ? 'none' : 'inline-block';
            // On step 1 the back button returns to the Welcome screen
            backBtn.textContent = this.currentStep === 1 ? '← Home' : '← Back';
        }

        if (nextBtn) {
            // Hide next button on steps 4 and 5 (they have their own action buttons)
            nextBtn.style.display = this.currentStep >= 4 ? 'none' : 'inline-block';

            // Enable/disable based on step requirements
            if (this.currentStep === 1) {
                nextBtn.disabled = !this.selectedDevice;
            } else if (this.currentStep === 3) {
                nextBtn.disabled = !this.destinationPath || !this.validationResult?.hasEnoughSpace;
            } else {
                nextBtn.disabled = false;
            }
        }
    }

    nextStep() {
        if (this.currentStep < this.maxSteps) {
            this.renderStep(this.currentStep + 1);
        }
    }

    previousStep() {
        if (this.currentStep === 1) {
            app.goHome();
        } else if (this.currentStep > 1) {
            this.renderStep(this.currentStep - 1);
        }
    }

    // ==================== STEP 1: Device Selection ====================
    async renderStep1_DeviceSelection() {
        const content = document.getElementById('importWizardContent');

        content.innerHTML = `
            <div style="padding: 2rem;">
                <h3 style="margin-bottom: 1.5rem;">Select SeeStar Device</h3>

                <div id="deviceLoading" style="text-align: center; padding: 2rem;">
                    <div class="loading-spinner" style="margin: 0 auto 1rem; width: 40px; height: 40px;"></div>
                    <p>Detecting devices...</p>
                </div>

                <div id="deviceContent" style="display: none;">
                    <div id="detectedDevices"></div>

                    <div style="margin-top: 2rem;">
                        <h4 style="margin-bottom: 1rem;">Or enter network path manually:</h4>
                        <div style="display: flex; gap: 0.5rem;">
                            <input type="text" id="manualPath" placeholder="\\\\seestar"
                                   style="flex: 1; padding: 0.75rem; background: var(--bg-tertiary);
                                          border: 2px solid var(--border-color); border-radius: 8px;
                                          color: var(--text-primary);">
                            <button class="btn btn-secondary" id="validatePathBtn">Validate</button>
                        </div>
                        <div id="pathValidationResult" style="margin-top: 0.5rem;"></div>
                    </div>
                </div>
            </div>
        `;

        // Detect devices
        await this.detectDevices();

        // Setup manual path validation
        const validateBtn = document.getElementById('validatePathBtn');
        if (validateBtn) {
            validateBtn.addEventListener('click', () => this.validateManualPath());
        }
    }

    async detectDevices() {
        try {
            const response = await fetch('/api/import/detect-seestar');
            const data = await response.json();

            const loading = document.getElementById('deviceLoading');
            const content = document.getElementById('deviceContent');

            if (loading) loading.style.display = 'none';
            if (content) content.style.display = 'block';

            if (data.success && data.devices) {
                // Store devices for fast re-rendering
                this.detectedDevices = data.devices.filter(d => d.hasMyWork);
                this.renderDevicesList();
            }
        } catch (error) {
            console.error('Error detecting devices:', error);
            alert('Error detecting devices: ' + error.message);
        }
    }

    renderDevicesList() {
        const devicesList = document.getElementById('detectedDevices');
        if (!devicesList) return;

        const availableDevices = this.detectedDevices || [];

        if (availableDevices.length > 0) {
            devicesList.innerHTML = `
                <h4 style="margin-bottom: 1rem;">Available Devices:</h4>
                ${availableDevices.map(device => `
                    <div class="device-card ${this.selectedDevice?.path === device.path ? 'selected' : ''}"
                         data-path="${device.path}"
                         data-full-path="${device.fullPath}">
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <span style="font-size: 2rem;">${device.type === 'network' ? '🌐' : '💾'}</span>
                            <div style="flex: 1;">
                                <strong>${device.label}</strong>
                                <br>
                                <span style="color: var(--text-secondary); font-size: 0.875rem;">
                                    ${device.fullPath}
                                </span>
                            </div>
                            ${this.selectedDevice?.path === device.path ? `
                                <button class="btn btn-primary device-proceed-btn" style="margin-left: auto;">
                                    Proceed →
                                </button>
                            ` : `
                                <span style="margin-left: auto; color: var(--success-color);">✓ ${this.seestarDirectoryName} Found</span>
                            `}
                        </div>
                    </div>
                `).join('')}
            `;

            // Add click handlers
            devicesList.querySelectorAll('.device-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    // Don't trigger selection if clicking the Proceed button
                    if (e.target.classList.contains('device-proceed-btn')) {
                        this.nextStep();
                        return;
                    }

                    this.selectedDevice = {
                        path: card.getAttribute('data-path'),
                        fullPath: card.getAttribute('data-full-path')
                    };

                    // Re-render UI instantly (no API call)
                    this.renderDevicesList();
                });
            });

            // Add click handler to Proceed buttons
            devicesList.querySelectorAll('.device-proceed-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.nextStep();
                });
            });
        } else {
            devicesList.innerHTML = `
                <div style="padding: 2rem; text-align: center; background: var(--bg-tertiary);
                            border-radius: 12px; border: 2px solid var(--border-color);">
                    <span style="font-size: 3rem;">📭</span>
                    <h4 style="margin-top: 1rem;">No SeeStar Devices Detected</h4>
                    <p style="color: var(--text-secondary); margin-top: 0.5rem;">
                        Please connect your SeeStar device or use the manual path entry below.
                    </p>
                </div>
            `;
        }
    }

    async validateManualPath() {
        const pathInput = document.getElementById('manualPath');
        const resultDiv = document.getElementById('pathValidationResult');
        const manualPath = pathInput?.value.trim();

        if (!manualPath) {
            resultDiv.innerHTML = '<span style="color: var(--danger-color);">Please enter a path</span>';
            return;
        }

        try {
            const fullPath = path.join(manualPath, this.seestarDirectoryName);
            const response = await fetch(`/api/browse/validate?path=${encodeURIComponent(fullPath)}&checkMyWork=false`);
            const data = await response.json();

            if (data.success && data.exists) {
                resultDiv.innerHTML = '<span style="color: var(--success-color);">✓ Valid path</span>';
                this.selectedDevice = {
                    path: manualPath,
                    fullPath: fullPath
                };
                this.updateNavigationButtons();
            } else {
                resultDiv.innerHTML = '<span style="color: var(--danger-color);">✗ Path not found or inaccessible</span>';
                this.selectedDevice = null;
                this.updateNavigationButtons();
            }
        } catch (error) {
            resultDiv.innerHTML = `<span style="color: var(--danger-color);">Error: ${error.message}</span>`;
            this.selectedDevice = null;
            this.updateNavigationButtons();
        }
    }

    // ==================== STEP 2: Strategy Selection ====================
    renderStep2_StrategySelection() {
        const content = document.getElementById('importWizardContent');

        content.innerHTML = `
            <div style="padding: 2rem;">
                <h3 style="margin-bottom: 1.5rem;">Select Import Strategy</h3>

                <div class="strategy-card ${this.selectedStrategy === 'incremental' ? 'selected' : ''}"
                     data-strategy="incremental">
                    <div style="display: flex; align-items: start; gap: 1rem;">
                        <span style="font-size: 2.5rem;">🔄</span>
                        <div>
                            <h4>Incremental Copy</h4>
                            <p style="color: var(--text-secondary); margin-top: 0.5rem;">
                                Only copy new or modified files. Skips files that already exist with the same size
                                and modification date. Recommended for updating an existing repository.
                            </p>
                            <ul style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.5rem;">
                                <li>Faster for updates</li>
                                <li>Saves disk space by avoiding duplicates</li>
                                <li>Preserves existing local files</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div class="strategy-card ${this.selectedStrategy === 'full' ? 'selected' : ''}"
                     data-strategy="full"
                     style="margin-top: 1rem;">
                    <div style="display: flex; align-items: start; gap: 1rem;">
                        <span style="font-size: 2.5rem;">📦</span>
                        <div>
                            <h4>Full Copy</h4>
                            <p style="color: var(--text-secondary); margin-top: 0.5rem;">
                                Copy all files from the SeeStar device, regardless of whether they already exist
                                locally. Recommended for first-time imports or creating a fresh backup.
                            </p>
                            <ul style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.5rem;">
                                <li>Complete copy of all data</li>
                                <li>Overwrites existing files</li>
                                <li>Best for new imports</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add click handlers
        content.querySelectorAll('.strategy-card').forEach(card => {
            card.addEventListener('click', () => {
                this.selectedStrategy = card.getAttribute('data-strategy');

                // Update UI
                content.querySelectorAll('.strategy-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
            });
        });
    }

    // ==================== STEP 3: Destination Selection ====================
    async renderStep3_DestinationSelection() {
        const content = document.getElementById('importWizardContent');

        content.innerHTML = `
            <div style="padding: 2rem;">
                <h3 style="margin-bottom: 1.5rem;">Select Destination Folder</h3>

                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Destination Path:</label>
                    <div style="display: flex; gap: 0.5rem;">
                        <input type="text" id="destPath" readonly
                               style="flex: 1; padding: 0.75rem; background: var(--bg-tertiary);
                                      border: 2px solid var(--border-color); border-radius: 8px;
                                      color: var(--text-primary);"
                               placeholder="Click Browse to select destination..."
                               value="${this.destinationPath || ''}">
                        <button class="btn btn-secondary" id="browseDestBtn">Browse</button>
                    </div>
                </div>

                <div id="spaceValidation" style="display: ${this.destinationPath ? 'block' : 'none'};">
                    <div class="space-info">
                        <h4 style="margin-bottom: 1rem;">Disk Space Validation</h4>
                        <div id="spaceContent">
                            <div style="text-align: center; padding: 1rem;">
                                <div class="loading-spinner" style="margin: 0 auto; width: 30px; height: 30px;"></div>
                                <p style="margin-top: 0.5rem;">Checking disk space...</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Setup browse button
        const browseBtn = document.getElementById('browseDestBtn');
        if (browseBtn) {
            browseBtn.addEventListener('click', () => this.showDestinationBrowser());
        }

        // If we already have a destination, validate space
        if (this.destinationPath) {
            await this.validateSpace();
        }
    }

    async showDestinationBrowser() {
        // Reuse the folder browser from modeSelection
        const modalBody = document.createElement('div');
        modalBody.innerHTML = `
            <div class="folder-browser">
                <div id="browserLoading" style="text-align: center; padding: 2rem;">
                    <div class="loading-spinner" style="margin: 0 auto 1rem; width: 40px; height: 40px;"></div>
                    <p>Loading drives...</p>
                </div>
                <div id="browserContent" style="display: none;">
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

        // Store the callback for later use
        const selectCallback = async () => {
            if (this.currentBrowsePath) {
                this.destinationPath = this.currentBrowsePath;
                document.getElementById('destPath').value = this.destinationPath;
                document.getElementById('spaceValidation').style.display = 'block';
                await this.validateSpace();
            }
        };

        app.showModal('Select Destination Folder', modalBody, selectCallback, 'Select This Folder');

        // Add custom footer with Create Folder button
        const modalFooter = document.getElementById('modalFooter');
        if (modalFooter) {
            // Create the Create Folder button
            const createFolderBtn = document.createElement('button');
            createFolderBtn.className = 'btn btn-secondary';
            createFolderBtn.textContent = '📁 Create New Folder';
            createFolderBtn.addEventListener('click', () => this.createNewFolder());

            // Insert at the beginning of the footer
            modalFooter.insertBefore(createFolderBtn, modalFooter.firstChild);
        }

        // Load initial data
        await this.loadBrowserData();
    }

    async loadBrowserData(targetPath = null) {
        try {
            if (!targetPath) {
                // Load drives
                const response = await fetch('/api/browse/drives');
                const data = await response.json();

                if (data.success) {
                    this.renderDrivesView(data.drives || []);
                }
            } else {
                // Load directory contents
                const response = await fetch(`/api/browse/directory?path=${encodeURIComponent(targetPath)}`);
                const data = await response.json();

                if (data.success) {
                    this.renderDirectoryView(targetPath, data.directories || []);
                } else {
                    alert('Error: ' + (data.error || 'Cannot access directory'));
                }
            }
        } catch (error) {
            console.error('Browse error:', error);
            alert('Error loading directory: ' + error.message);
        }
    }

    renderDrivesView(drives) {
        const loading = document.getElementById('browserLoading');
        const content = document.getElementById('browserContent');
        const browserList = document.getElementById('browserList');
        const currentPathInput = document.getElementById('browserCurrentPath');

        if (loading) loading.style.display = 'none';
        if (content) content.style.display = 'block';
        if (currentPathInput) currentPathInput.value = 'Select a drive';

        this.currentBrowsePath = null;

        if (browserList) {
            browserList.innerHTML = drives.map(drive => `
                <div class="folder-item" data-path="${drive.path}" style="padding: 0.75rem; cursor: pointer;
                     border-bottom: 1px solid var(--border-color); transition: background 0.2s;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span>💾</span>
                        <span>${drive.name}</span>
                    </div>
                </div>
            `).join('');

            browserList.querySelectorAll('.folder-item').forEach(item => {
                item.addEventListener('click', () => {
                    const drivePath = item.getAttribute('data-path');
                    this.loadBrowserData(drivePath);
                });

                item.addEventListener('mouseenter', (e) => {
                    e.currentTarget.style.background = 'var(--bg-secondary)';
                });

                item.addEventListener('mouseleave', (e) => {
                    e.currentTarget.style.background = 'transparent';
                });
            });
        }
    }

    renderDirectoryView(currentPath, directories) {
        const browserList = document.getElementById('browserList');
        const currentPathInput = document.getElementById('browserCurrentPath');
        const upBtn = document.getElementById('browserUpBtn');

        this.currentBrowsePath = currentPath;

        if (currentPathInput) {
            currentPathInput.value = currentPath;
        }

        if (upBtn) {
            upBtn.onclick = () => {
                const parentPath = path.dirname(currentPath);
                if (parentPath && parentPath !== currentPath) {
                    this.loadBrowserData(parentPath);
                } else {
                    this.loadBrowserData(null); // Back to drives
                }
            };
        }

        if (browserList) {
            // Handle empty directories
            if (!directories || directories.length === 0) {
                browserList.innerHTML = `
                    <div style="padding: 2rem; text-align: center; color: var(--text-secondary);">
                        <span style="font-size: 2rem;">📂</span>
                        <p style="margin-top: 0.5rem;">No subdirectories found</p>
                    </div>
                `;
                return;
            }

            browserList.innerHTML = directories.map(dir => `
                <div class="folder-item" data-path="${dir.path}" style="padding: 0.75rem; cursor: pointer;
                     border-bottom: 1px solid var(--border-color); transition: background 0.2s;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span>📁</span>
                        <span>${dir.name}</span>
                    </div>
                </div>
            `).join('');

            browserList.querySelectorAll('.folder-item').forEach(item => {
                item.addEventListener('click', () => {
                    const dirPath = item.getAttribute('data-path');
                    this.loadBrowserData(dirPath);
                });

                item.addEventListener('mouseenter', (e) => {
                    e.currentTarget.style.background = 'var(--bg-secondary)';
                });

                item.addEventListener('mouseleave', (e) => {
                    e.currentTarget.style.background = 'transparent';
                });
            });
        }
    }

    async createNewFolder() {
        if (!this.currentBrowsePath) {
            alert('Please select a location first (click on a drive or folder)');
            return;
        }

        const folderName = prompt('Enter new folder name:');
        if (!folderName || folderName.trim() === '') {
            return;
        }

        // Validate folder name (no invalid characters)
        const invalidChars = /[<>:"/\\|?*]/;
        if (invalidChars.test(folderName)) {
            alert('Folder name contains invalid characters. Please avoid: < > : " / \\ | ? *');
            return;
        }

        try {
            const response = await fetch('/api/browse/create-directory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    parentPath: this.currentBrowsePath,
                    folderName: folderName.trim()
                })
            });

            const data = await response.json();

            if (data.success) {
                alert(`Folder "${folderName}" created successfully!`);
                // Refresh the current directory view
                await this.loadBrowserData(this.currentBrowsePath);
            } else {
                alert('Error creating folder: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error creating folder:', error);
            alert('Error creating folder: ' + error.message);
        }
    }

    async validateSpace() {
        const spaceContent = document.getElementById('spaceContent');
        if (!spaceContent) return;

        try {
            const response = await fetch('/api/import/validate-space', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourcePath: this.selectedDevice.fullPath,
                    destinationPath: this.destinationPath,
                    strategy: this.selectedStrategy || 'full'
                })
            });

            const data = await response.json();

            if (data.success) {
                this.validationResult = data;

                const isIncremental = data.strategy === 'incremental';
                const strategyNote = isIncremental
                    ? '<p style="color: var(--text-secondary); margin-top: 0.5rem; font-size: 0.875rem;">ℹ️ Incremental copy: showing space needed for new/modified files only</p>'
                    : '';

                spaceContent.innerHTML = `
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div>
                            <strong>Required${isIncremental ? ' (Differential)' : ''}:</strong><br>
                            <span style="font-size: 1.25rem; color: var(--text-secondary);">
                                ${data.requiredFormatted}
                            </span>
                        </div>
                        <div>
                            <strong>Available:</strong><br>
                            <span style="font-size: 1.25rem; color: var(--text-secondary);">
                                ${data.availableFormatted}
                            </span>
                        </div>
                    </div>
                    <div class="space-status ${data.hasEnoughSpace ? 'success' : 'error'}"
                         style="margin-top: 1rem; font-size: 1.1rem; font-weight: 600;">
                        ${data.hasEnoughSpace ? '✓ Sufficient disk space' : '✗ Insufficient disk space'}
                    </div>
                    ${strategyNote}
                    ${!data.hasEnoughSpace ? `
                        <p style="color: var(--danger-color); margin-top: 0.5rem; font-size: 0.875rem;">
                            Please select a destination with at least ${data.requiredFormatted} of free space.
                        </p>
                    ` : ''}
                `;

                this.updateNavigationButtons();
            } else {
                spaceContent.innerHTML = `
                    <p style="color: var(--danger-color);">Error validating disk space: ${data.error}</p>
                `;
            }
        } catch (error) {
            console.error('Error validating space:', error);
            spaceContent.innerHTML = `
                <p style="color: var(--danger-color);">Error: ${error.message}</p>
            `;
        }
    }

    // ==================== STEP 4: Confirmation ====================
    async renderStep4_Confirmation() {
        const content = document.getElementById('importWizardContent');

        content.innerHTML = `
            <div style="padding: 2rem;">
                <h3 style="margin-bottom: 1.5rem;">Confirm Import Settings</h3>

                <div style="background: var(--bg-tertiary); border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem;">
                    <table style="width: 100%;">
                        <tr>
                            <td style="padding: 0.75rem; font-weight: 600; color: var(--text-secondary);">Source:</td>
                            <td style="padding: 0.75rem;">${this.selectedDevice.fullPath}</td>
                        </tr>
                        <tr>
                            <td style="padding: 0.75rem; font-weight: 600; color: var(--text-secondary);">Destination:</td>
                            <td style="padding: 0.75rem;">${this.destinationPath}</td>
                        </tr>
                        <tr>
                            <td style="padding: 0.75rem; font-weight: 600; color: var(--text-secondary);">Strategy:</td>
                            <td style="padding: 0.75rem;">
                                ${this.selectedStrategy === 'incremental' ? '🔄 Incremental Copy' : '📦 Full Copy'}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 0.75rem; font-weight: 600; color: var(--text-secondary);">Required Space:</td>
                            <td style="padding: 0.75rem;">${this.validationResult.requiredFormatted}</td>
                        </tr>
                        <tr>
                            <td style="padding: 0.75rem; font-weight: 600; color: var(--text-secondary);">Available Space:</td>
                            <td style="padding: 0.75rem; color: var(--success-color);">
                                ${this.validationResult.availableFormatted}
                            </td>
                        </tr>
                    </table>
                </div>

                <div style="background: var(--bg-secondary); border-left: 4px solid var(--primary-color);
                            padding: 1rem; border-radius: 8px; margin-bottom: 2rem;">
                    <p style="margin: 0; color: var(--text-secondary);">
                        <strong>Note:</strong> Files on the SeeStar device will not be modified.
                        This is a read-only copy operation.
                    </p>
                </div>

                <div style="text-align: center;">
                    <button class="btn btn-primary" id="startImportBtn" style="padding: 1rem 2rem; font-size: 1.1rem;">
                        🚀 Start Import
                    </button>
                </div>
            </div>
        `;

        const startBtn = document.getElementById('startImportBtn');
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startImport());
        }
    }

    // ==================== STEP 5: Progress Display ====================
    renderStep5_Progress() {
        const content = document.getElementById('importWizardContent');

        content.innerHTML = `
            <div style="padding: 2rem;">
                <div class="import-progress">
                    <div class="progress-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                        <h3 style="margin: 0;" id="progressHeaderText">Importing Files...</h3>
                        <div>
                            <button class="btn btn-secondary" id="cancelImportBtn">Cancel</button>
                            <button class="btn btn-primary" id="doneImportBtn" style="display: none;">Done</button>
                        </div>
                    </div>

                    <div class="progress-bar-container">
                        <div class="progress-bar" id="progressBar" style="width: 0%;">0%</div>
                    </div>

                    <div class="progress-stats" id="progressStats">
                        <div class="current-file" id="currentFile">Preparing import...</div>
                        <div id="fileCount">Files: 0 / 0</div>
                        <div id="byteCount">Data: 0 B / 0 B</div>
                        <div id="speed">Speed: 0 MB/s</div>
                        <div id="eta">Time Remaining: Calculating...</div>
                        <div id="skipped" style="display: none;">Skipped: 0</div>
                    </div>
                </div>
            </div>
        `;

        const cancelBtn = document.getElementById('cancelImportBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.cancelImport());
        }

        const doneBtn = document.getElementById('doneImportBtn');
        if (doneBtn) {
            console.log('Done button found, attaching event listener');
            doneBtn.addEventListener('click', () => {
                console.log('Done button clicked!');
                this.showImportCompleteModal();
            });
        } else {
            console.error('Done button not found in DOM');
        }
    }

    async startImport() {
        try {
            // Move to progress step
            await this.renderStep(5);

            // Get socket ID
            const socketId = app.socket?.id;
            if (!socketId) {
                throw new Error('Socket.IO not connected');
            }

            // Start import
            const response = await fetch('/api/import/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourcePath: this.selectedDevice.fullPath,
                    destinationPath: this.destinationPath,
                    strategy: this.selectedStrategy,
                    socketId: socketId
                })
            });

            const data = await response.json();

            if (data.success) {
                this.operationId = data.operationId;
                console.log('Import started:', this.operationId);
            } else {
                throw new Error(data.error || 'Failed to start import');
            }
        } catch (error) {
            console.error('Error starting import:', error);
            alert('Error starting import: ' + error.message);
        }
    }

    async cancelImport() {
        if (!confirm('Are you sure you want to cancel the import?')) {
            return;
        }

        try {
            const response = await fetch('/api/import/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();

            if (data.success) {
                console.log('Import cancelled');
            }
        } catch (error) {
            console.error('Error cancelling import:', error);
        }
    }

    handleProgressUpdate(data) {
        const progressBar = document.getElementById('progressBar');
        const currentFile = document.getElementById('currentFile');
        const fileCount = document.getElementById('fileCount');
        const byteCount = document.getElementById('byteCount');
        const speed = document.getElementById('speed');
        const eta = document.getElementById('eta');
        const skipped = document.getElementById('skipped');

        if (progressBar) {
            const percentage = data.bytesPercentage || 0;
            progressBar.style.width = percentage + '%';
            progressBar.textContent = percentage + '%';
        }

        if (currentFile) {
            currentFile.textContent = `Copying: ${data.currentFile || 'Please wait...'}`;
        }

        if (fileCount) {
            fileCount.textContent = `Files: ${data.filesCopied || 0} / ${data.totalFiles || 0} (${data.filesPercentage || 0}%)`;
        }

        if (byteCount) {
            const copiedFormatted = this.formatBytes(data.bytesCopied || 0);
            const totalFormatted = this.formatBytes(data.totalBytes || 0);
            byteCount.textContent = `Data: ${copiedFormatted} / ${totalFormatted} (${data.bytesPercentage || 0}%)`;
        }

        if (speed) {
            speed.textContent = `Speed: ${data.speedFormatted || '0 B/s'}`;
        }

        if (eta) {
            eta.textContent = `Time Remaining: ${data.timeRemainingFormatted || 'Calculating...'}`;
        }

        if (skipped && data.filesSkipped > 0) {
            skipped.style.display = 'block';
            skipped.textContent = `Skipped: ${data.filesSkipped}`;
        }
    }

    async handleImportComplete(data) {
        console.log('Import complete:', data);

        // Store import completion data for validation
        this.importCompleteData = data;

        // Update progress screen to show completion
        const headerText = document.getElementById('progressHeaderText');
        const cancelBtn = document.getElementById('cancelImportBtn');
        const doneBtn = document.getElementById('doneImportBtn');
        const currentFile = document.getElementById('currentFile');

        if (headerText) {
            headerText.textContent = 'Import Complete!';
            headerText.style.color = 'var(--success-color)';
        }

        if (currentFile) {
            currentFile.textContent = `✓ All files imported successfully`;
            currentFile.style.color = 'var(--success-color)';
        }

        // Hide cancel button, show done button
        if (cancelBtn) {
            cancelBtn.style.display = 'none';
            console.log('Cancel button hidden');
        }

        if (doneBtn) {
            doneBtn.style.display = 'inline-block';
            console.log('Done button made visible');
        } else {
            console.error('Done button not found when trying to show it');
        }
    }

    showImportCompleteModal() {
        console.log('showImportCompleteModal() called');
        const data = this.importCompleteData;

        if (!data) {
            console.error('No import completion data available');
            return;
        }
        console.log('Import completion data:', data);

        // Create modal content
        const modalContent = `
            <div style="text-align: center; padding: 1rem;">
                <div style="font-size: 4rem; margin-bottom: 1rem;">✓</div>
                <h3 style="margin-bottom: 1rem;">Import Successful!</h3>
                <div style="text-align: left; background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                    <p><strong>Files Copied:</strong> ${data.filesCopied}</p>
                    ${data.filesSkipped > 0 ? `<p><strong>Files Skipped:</strong> ${data.filesSkipped}</p>` : ''}
                    <p><strong>Total Data:</strong> ${data.totalBytesFormatted}</p>
                    <p><strong>Duration:</strong> ${data.durationFormatted}</p>
                    ${data.errors && data.errors.length > 0 ? `
                        <p style="color: var(--danger-color);"><strong>Errors:</strong> ${data.errors.length} files failed</p>
                    ` : ''}
                </div>
                <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 1rem;">
                    <p style="margin-bottom: 0.5rem; font-size: 0.9rem;">
                        <strong>Recommended:</strong> Validate the transfer to ensure all files were copied correctly.
                    </p>
                    <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary);">
                        This will verify that all source files exist in the destination with the correct size.
                    </p>
                </div>
            </div>
        `;

        // Show modal with Validate Transfer as primary action
        app.showModal(
            'Import Complete',
            modalContent,
            () => {
                this.startValidation();
            },
            'Validate Transfer'
        );

        // Add "Skip & View Dashboard" button to footer
        const modalFooter = document.getElementById('modalFooter');
        if (modalFooter) {
            const skipBtn = document.createElement('button');
            skipBtn.className = 'btn btn-secondary';
            skipBtn.textContent = 'Skip & View Dashboard';
            skipBtn.addEventListener('click', async () => {
                app.hideModal();
                await this.proceedToDashboard();
            });

            // Insert at the beginning of the footer (before Validate button)
            modalFooter.insertBefore(skipBtn, modalFooter.firstChild);
        }
    }

    handleImportError(data) {
        console.error('Import error:', data);

        app.showModal(
            'Import Error',
            `
                <div style="text-align: center; padding: 1rem;">
                    <div style="font-size: 4rem; margin-bottom: 1rem; color: var(--danger-color);">✗</div>
                    <h3 style="margin-bottom: 1rem;">Import Failed</h3>
                    <p style="color: var(--danger-color);">${data.error || 'An unknown error occurred'}</p>
                </div>
            `,
            () => {
                this.renderStep(1); // Go back to start
            },
            'Try Again'
        );
    }

    handleImportCancelled(data) {
        console.log('Import cancelled:', data);

        app.showModal(
            'Import Cancelled',
            `
                <div style="text-align: center; padding: 1rem;">
                    <div style="font-size: 4rem; margin-bottom: 1rem;">⊘</div>
                    <h3 style="margin-bottom: 1rem;">Import Cancelled</h3>
                    <p>The import operation was cancelled by user.</p>
                    <div style="text-align: left; background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; margin-top: 1rem;">
                        <p><strong>Files Copied:</strong> ${data.filesCopied || 0}</p>
                        <p><strong>Data Transferred:</strong> ${this.formatBytes(data.bytesCopied || 0)}</p>
                    </div>
                </div>
            `,
            () => {
                this.renderStep(1); // Go back to start
            },
            'OK'
        );
    }

    formatBytes(bytes, decimals = 1) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    async startValidation() {
        console.log('Starting transfer validation...');

        // Close the modal first
        app.hideModal();

        // Show validation progress UI in the wizard content area
        const content = document.getElementById('importWizardContent');
        if (content) {
            content.innerHTML = `
                <div style="padding: 2rem;">
                    <div class="import-progress">
                        <div class="progress-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                            <h3 style="margin: 0;" id="validationHeaderText">Validating Transfer...</h3>
                        </div>

                        <div class="progress-bar-container">
                            <div class="progress-bar" id="validationProgressBar" style="width: 0%;">0%</div>
                        </div>

                        <div class="progress-stats" id="validationStats">
                            <div class="current-file" id="validationStatus">Scanning files...</div>
                            <div id="validatedCount">Files Validated: 0 / 0</div>
                            <div id="issuesCount">Issues Found: 0</div>
                        </div>
                    </div>
                </div>
            `;
        }

        try {
            const response = await fetch('/api/import/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourcePath: this.selectedDevice.fullPath,
                    destinationPath: this.destinationPath,
                    socketId: app.socket.id
                })
            });

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to start validation');
            }

            console.log('Validation started:', data.operationId);
        } catch (error) {
            console.error('Error starting validation:', error);
            alert('Failed to start validation: ' + error.message);
        }
    }

    handleValidationProgress(data) {
        // Only handle if import wizard is active (not merge wizard)
        const importWizardScreen = document.getElementById('importWizardScreen');
        if (!importWizardScreen || !importWizardScreen.classList.contains('active')) {
            return;
        }

        const statusEl = document.getElementById('validationStatus');
        const validatedCountEl = document.getElementById('validatedCount');
        const issuesCountEl = document.getElementById('issuesCount');
        const progressBar = document.getElementById('validationProgressBar');

        if (data.status === 'scanning') {
            if (statusEl) statusEl.textContent = data.message || 'Scanning files...';
        } else if (data.status === 'validating') {
            if (statusEl) {
                statusEl.textContent = `Validating files... (${data.filesValidated || 0} / ${data.totalFiles || 0})`;
                statusEl.style.color = 'var(--text-secondary)';
            }
            if (validatedCountEl) {
                validatedCountEl.textContent = `Files Validated: ${data.filesValidated || 0} / ${data.totalFiles || 0}`;
            }
            if (issuesCountEl) {
                const issues = data.mismatches || 0;
                issuesCountEl.textContent = `Issues Found: ${issues}`;
                issuesCountEl.style.color = issues > 0 ? 'var(--danger-color)' : 'var(--success-color)';
            }
            if (progressBar) {
                const percentage = data.percentage || 0;
                progressBar.style.width = percentage + '%';
                progressBar.textContent = percentage + '%';
            }
        }
    }

    handleValidationComplete(data) {
        console.log('Validation complete:', data);

        // Only handle if import wizard is active (not merge wizard)
        const importWizardScreen = document.getElementById('importWizardScreen');
        if (!importWizardScreen || !importWizardScreen.classList.contains('active')) {
            console.log('Import wizard not active, ignoring validation event');
            return;
        }

        const isValid = data.isValid;
        const hasIssues = data.mismatches && data.mismatches.length > 0;

        let mismatchesHtml = '';
        if (hasIssues) {
            mismatchesHtml = `
                <div style="margin-top: 1rem; max-height: 300px; overflow-y: auto; text-align: left; background: var(--bg-tertiary); padding: 1rem; border-radius: 8px;">
                    <h4 style="margin-top: 0;">Issues Found (${data.mismatches.length}):</h4>
                    <ul style="margin: 0; padding-left: 1.5rem; font-size: 0.9rem;">
                        ${data.mismatches.slice(0, 50).map(m => `
                            <li style="margin-bottom: 0.5rem;">
                                <strong>${m.file}</strong><br>
                                <span style="color: var(--danger-color);">${m.message}</span>
                            </li>
                        `).join('')}
                        ${data.mismatches.length > 50 ? `<li><em>...and ${data.mismatches.length - 50} more</em></li>` : ''}
                    </ul>
                </div>
            `;
        }

        app.showModal(
            isValid ? 'Validation Successful' : 'Validation Failed',
            `
                <div style="text-align: center; padding: 1rem;">
                    <div style="font-size: 4rem; margin-bottom: 1rem; color: ${isValid ? 'var(--success-color)' : 'var(--danger-color)'});">
                        ${isValid ? '✓' : '⚠'}
                    </div>
                    <h3 style="margin-bottom: 1rem;">${isValid ? 'Transfer Validated Successfully!' : 'Transfer Validation Issues'}</h3>
                    <div style="text-align: left; background: var(--bg-secondary); padding: 1rem; border-radius: 8px;">
                        <p><strong>Files Validated:</strong> ${data.filesValidated}</p>
                        <p><strong>Issues Found:</strong> <span style="color: ${hasIssues ? 'var(--danger-color)' : 'var(--success-color)'};">${data.mismatches.length}</span></p>
                        <p><strong>Duration:</strong> ${data.durationFormatted}</p>
                    </div>
                    ${mismatchesHtml}
                    ${!isValid ? `
                        <p style="margin-top: 1rem; color: var(--text-secondary); font-size: 0.9rem;">
                            Some files may not have been copied correctly. You may want to re-run the import.
                        </p>
                    ` : ''}
                </div>
            `,
            async () => {
                await this.proceedToDashboard();
            },
            'View Dashboard'
        );
    }

    handleValidationError(data) {
        console.error('Validation error:', data);

        // Only handle if import wizard is active (not merge wizard)
        const importWizardScreen = document.getElementById('importWizardScreen');
        if (!importWizardScreen || !importWizardScreen.classList.contains('active')) {
            console.log('Import wizard not active, ignoring validation error event');
            return;
        }

        app.showModal(
            'Validation Error',
            `
                <div style="text-align: center; padding: 1rem;">
                    <div style="font-size: 4rem; margin-bottom: 1rem; color: var(--danger-color);">✗</div>
                    <h3 style="margin-bottom: 1rem;">Validation Error</h3>
                    <p>An error occurred while validating the transfer:</p>
                    <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; margin-top: 1rem;">
                        <code style="color: var(--danger-color);">${data.error}</code>
                    </div>
                </div>
            `,
            async () => {
                await this.proceedToDashboard();
            },
            'View Dashboard Anyway'
        );
    }

    async proceedToDashboard() {
        app.showLoading('Analyzing imported files...');
        try {
            const response = await fetch(`/api/analyze?path=${encodeURIComponent(this.destinationPath)}`);
            const analysisData = await response.json();

            if (analysisData.success) {
                app.hideLoading();
                // Use window.dashboard (not app.dashboard)
                if (window.dashboard) {
                    window.dashboard.displayResults(analysisData, this.destinationPath);
                    app.showScreen('dashboardScreen');
                } else {
                    throw new Error('Dashboard not initialized');
                }
            } else {
                throw new Error(analysisData.error || 'Analysis failed');
            }
        } catch (error) {
            app.hideLoading();
            alert('Error analyzing imported files: ' + error.message);
        }
    }
}

// Note: path is a browser-compatible implementation
const path = {
    join: (...parts) => {
        return parts.join('\\').replace(/\\+/g, '\\');
    },
    dirname: (p) => {
        const parts = p.split('\\');
        parts.pop();
        return parts.join('\\');
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new ImportWizard();
});
