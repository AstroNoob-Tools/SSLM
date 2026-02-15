/**
 * MergeWizard - 6-step wizard for merging multiple SeeStar libraries
 */
class MergeWizard {
    constructor() {
        this.currentStep = 1;
        this.maxSteps = 6;
        this.sourcePaths = []; // Array of selected source library paths
        this.destinationPath = null;
        this.mergePlan = null;
        this.validationResult = null;
        this.operationId = null;
        this.currentBrowsePath = null;

        console.log('MergeWizard initialized');
        this.init();
    }

    async init() {
        console.log('MergeWizard module loaded');
        this.setupEventListeners();
        this.setupProgressListener();
        await this.renderStep(1);
    }

    setupEventListeners() {
        const backBtn = document.getElementById('mergeWizardBackBtn');
        const nextBtn = document.getElementById('mergeWizardNextBtn');

        if (backBtn) backBtn.addEventListener('click', () => this.previousStep());
        if (nextBtn) nextBtn.addEventListener('click', () => this.nextStep());
    }

    setupProgressListener() {
        if (!app.socket) {
            console.warn('Socket.IO not available');
            return;
        }

        // Merge progress events
        app.socket.on('merge:progress', (data) => this.handleProgressUpdate(data));
        app.socket.on('merge:complete', (data) => this.handleMergeComplete(data));
        app.socket.on('merge:error', (data) => this.handleMergeError(data));
        app.socket.on('merge:cancelled', (data) => this.handleMergeCancelled(data));

        // Validation events (reuse from import)
        app.socket.on('validate:progress', (data) => this.handleValidationProgress(data));
        app.socket.on('validate:complete', (data) => this.handleValidationComplete(data));
        app.socket.on('validate:error', (data) => this.handleValidationError(data));
    }

    async renderStep(stepNumber) {
        this.currentStep = stepNumber;
        this.updateStepIndicators();

        const content = document.getElementById('mergeWizardContent');
        if (!content) return;

        switch (stepNumber) {
            case 1: await this.renderStep1_SourceSelection(); break;
            case 2: await this.renderStep2_DestinationSelection(); break;
            case 3: await this.renderStep3_AnalysisPreview(); break;
            case 4: await this.renderStep4_Confirmation(); break;
            case 5: this.renderStep5_MergeProgress(); break;
            case 6: this.renderStep6_Validation(); break;
        }

        this.updateNavigationButtons();
    }

    updateStepIndicators() {
        // Query step indicators specifically within merge wizard screen
        const mergeWizard = document.getElementById('mergeWizardScreen');
        if (!mergeWizard) return;

        const steps = mergeWizard.querySelectorAll('.step');
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
        const backBtn = document.getElementById('mergeWizardBackBtn');
        const nextBtn = document.getElementById('mergeWizardNextBtn');
        const footer = document.querySelector('.merge-wizard-footer');

        if (backBtn && nextBtn) {
            backBtn.style.display = this.currentStep > 1 && this.currentStep < 5 ? 'inline-block' : 'none';
            nextBtn.style.display = this.currentStep < 5 ? 'inline-block' : 'none';
        }

        // Ensure footer has proper flexbox layout for button positioning
        if (footer) {
            footer.style.display = 'flex';
            footer.style.justifyContent = 'space-between';
            footer.style.alignItems = 'center';
            footer.style.padding = '1rem 2rem';
            footer.style.borderTop = '1px solid var(--border-color)';
        }
    }

    async nextStep() {
        if (this.currentStep < this.maxSteps) {
            if (await this.validateCurrentStep()) {
                await this.renderStep(this.currentStep + 1);
            }
        }
    }

    async previousStep() {
        if (this.currentStep > 1) {
            await this.renderStep(this.currentStep - 1);
        }
    }

    async validateCurrentStep() {
        switch (this.currentStep) {
            case 1:
                if (this.sourcePaths.length < 2) {
                    app.showModal('Error', 'Please select at least 2 source libraries to merge.');
                    return false;
                }
                return true;
            case 2:
                if (!this.destinationPath) {
                    app.showModal('Error', 'Please select a destination directory.');
                    return false;
                }
                return true;
            default:
                return true;
        }
    }

    // ========================================================================
    // Step 1: Source Library Selection
    // ========================================================================

    async renderStep1_SourceSelection() {
        const content = document.getElementById('mergeWizardContent');
        content.innerHTML = `
            <div style="display: flex; flex-direction: column; height: 100%;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem;">
                    <div style="flex: 1;">
                        <h3 style="margin: 0 0 0.5rem 0;">Select Source Libraries (Minimum 2)</h3>
                        <p style="margin: 0; color: var(--text-secondary); font-size: 0.95em;">
                            Choose the SeeStar library copies you want to merge.
                        </p>
                    </div>
                    <button class="btn btn-secondary" id="addSourceBtn" style="flex-shrink: 0; margin-left: 1rem;">
                        + Add Library
                    </button>
                </div>

                <div class="selected-sources" id="selectedSourcesList" style="flex: 1; overflow-y: auto;">
                    ${this.sourcePaths.length === 0
                        ? '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary);"><p>No sources selected yet. Click "Add Library" to select folders.</p></div>'
                        : this.renderSelectedSources()}
                </div>
            </div>
        `;

        // Add event listener for add source button
        document.getElementById('addSourceBtn').addEventListener('click', () => {
            this.showFolderBrowserForSource();
        });

        // Add event listeners for remove buttons
        document.querySelectorAll('.remove-source-btn').forEach((btn, index) => {
            btn.addEventListener('click', () => this.removeSource(index));
        });
    }

    renderSelectedSources() {
        return this.sourcePaths.map((sourcePath, index) => `
            <div class="source-item" style="display: flex; align-items: center; gap: 1rem; padding: 1rem;
                 background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px;
                 margin-bottom: 0.75rem;">
                <button class="btn btn-danger btn-sm remove-source-btn" data-index="${index}"
                        style="flex-shrink: 0; padding: 0.5rem 0.75rem;">
                    ✕
                </button>
                <div class="source-info" style="display: flex; align-items: center; gap: 0.75rem; flex: 1; min-width: 0;">
                    <div class="source-icon" style="font-size: 1.5rem; flex-shrink: 0;">📁</div>
                    <div class="source-details" style="flex: 1; min-width: 0;">
                        <div class="source-name" style="font-weight: 600; margin-bottom: 0.25rem;">
                            Library ${index + 1}
                        </div>
                        <div class="source-path" style="color: var(--text-secondary); font-size: 0.9em;
                             overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                             title="${sourcePath}">
                            ${sourcePath}
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    removeSource(index) {
        this.sourcePaths.splice(index, 1);
        this.renderStep1_SourceSelection();
    }

    async showFolderBrowserForSource() {
        // Show folder browser modal
        const selectedPath = await this.showFolderBrowser('Select SeeStar Library');

        if (selectedPath) {
            // Check if path already selected
            if (this.sourcePaths.includes(selectedPath)) {
                app.showModal('Duplicate', 'This library is already selected.');
                return;
            }

            // Add to sources list
            this.sourcePaths.push(selectedPath);
            await this.renderStep1_SourceSelection();
        }
    }

    // ========================================================================
    // Step 2: Destination Selection
    // ========================================================================

    async renderStep2_DestinationSelection() {
        const content = document.getElementById('mergeWizardContent');
        content.innerHTML = `
            <div class="wizard-step-content">
                <h3>Select Destination for Merged Library</h3>
                <p>Choose where the merged library should be created. A new directory will be created to store all merged files.</p>

                <div class="destination-display">
                    ${this.destinationPath
                        ? `
                            <div class="selected-destination">
                                <div class="destination-icon">📂</div>
                                <div class="destination-path">${this.destinationPath}</div>
                            </div>
                        `
                        : '<p class="text-muted">No destination selected. Click "Browse" to select a folder.</p>'
                    }
                </div>

                <button class="btn btn-primary" id="browseDestinationBtn">
                    Browse for Folder
                </button>
            </div>
        `;

        document.getElementById('browseDestinationBtn').addEventListener('click', async () => {
            const selectedPath = await this.showFolderBrowser('Select Destination Directory');
            if (selectedPath) {
                this.destinationPath = selectedPath;
                await this.renderStep2_DestinationSelection();
            }
        });
    }

    // ========================================================================
    // Step 3: Analysis & Preview
    // ========================================================================

    async renderStep3_AnalysisPreview() {
        const content = document.getElementById('mergeWizardContent');
        content.innerHTML = `
            <div class="wizard-step-content">
                <h3>Analyzing Libraries...</h3>
                <div class="loading-indicator">
                    <div class="spinner"></div>
                    <p>Scanning source libraries and building merge plan...</p>
                </div>
            </div>
        `;

        try {
            // Call analyze API
            const response = await fetch('/api/merge/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourcePaths: this.sourcePaths,
                    destinationPath: this.destinationPath
                })
            });

            const result = await response.json();

            if (result.success) {
                this.mergePlan = result;
                this.displayAnalysisResults(result);
            } else {
                throw new Error(result.error || 'Analysis failed');
            }
        } catch (error) {
            console.error('Error analyzing merge:', error);
            content.innerHTML = `
                <div class="wizard-step-content">
                    <h3>Analysis Failed</h3>
                    <p class="error-message">${error.message}</p>
                    <button class="btn btn-secondary" onclick="mergeWizard.previousStep()">
                        ← Go Back
                    </button>
                </div>
            `;
        }
    }

    displayAnalysisResults(mergePlan) {
        const content = document.getElementById('mergeWizardContent');
        content.innerHTML = `
            <div class="wizard-step-content">
                <h3>Merge Plan Preview</h3>

                <div class="merge-stats-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Metric</th>
                                <th>Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td class="stat-label">Source Libraries</td>
                                <td class="stat-value">${this.sourcePaths.length}</td>
                            </tr>
                            <tr>
                                <td class="stat-label">Total Files (All Sources)</td>
                                <td class="stat-value">${mergePlan.totalFiles.toLocaleString()}</td>
                            </tr>
                            <tr>
                                <td class="stat-label">Duplicates Found</td>
                                <td class="stat-value">${mergePlan.duplicates.count.toLocaleString()}</td>
                            </tr>
                            <tr class="${mergePlan.conflicts.count > 0 ? 'highlight' : ''}">
                                <td class="stat-label">Conflicts to Resolve</td>
                                <td class="stat-value">${mergePlan.conflicts.count.toLocaleString()}</td>
                            </tr>
                            <tr class="highlight">
                                <td class="stat-label">Final File Count</td>
                                <td class="stat-value">${mergePlan.uniqueFiles.toLocaleString()}</td>
                            </tr>
                            <tr class="highlight">
                                <td class="stat-label">Total Size</td>
                                <td class="stat-value">${this.formatBytes(mergePlan.totalBytes)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                ${mergePlan.conflicts.count > 0 ? `
                    <div class="conflict-preview">
                        <h4>Conflict Resolution Preview</h4>
                        <p class="text-muted">When files with the same path exist in multiple libraries, the newer version (by modification date) will be selected.</p>

                        <table class="conflict-table">
                            <thead>
                                <tr>
                                    <th>File Path</th>
                                    <th>Selected Version</th>
                                    <th>Reason</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${mergePlan.conflicts.resolutions.slice(0, 10).map(res => `
                                    <tr>
                                        <td class="file-path">${res.relativePath}</td>
                                        <td class="winning-source">✓ ${this.getShortPath(res.winningSource)}</td>
                                        <td class="reason">${res.reason}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        ${mergePlan.conflicts.count > 10 ? `
                            <p class="text-muted">Showing first 10 of ${mergePlan.conflicts.count} conflicts</p>
                        ` : ''}
                    </div>
                ` : '<p class="success-message">No conflicts found! All files are unique across libraries.</p>'}
            </div>
        `;
    }

    // ========================================================================
    // Step 4: Confirmation
    // ========================================================================

    async renderStep4_Confirmation() {
        const content = document.getElementById('mergeWizardContent');

        // Calculate space requirements
        let spaceValidation = null;
        try {
            const response = await fetch('/api/merge/validate-space', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourcePaths: this.sourcePaths,
                    destinationPath: this.destinationPath
                })
            });

            const result = await response.json();
            if (result.success) {
                spaceValidation = result;
            }
        } catch (error) {
            console.error('Error validating space:', error);
        }

        content.innerHTML = `
            <div class="wizard-step-content">
                <h3>Confirm Merge Operation</h3>

                <div class="merge-stats-table" style="margin-bottom: 1.5rem;">
                    <table>
                        <thead>
                            <tr>
                                <th colspan="2">Source Libraries</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.sourcePaths.map((path, i) => `
                                <tr>
                                    <td class="stat-label">${i + 1}. ${this.getShortPath(path)}</td>
                                    <td class="stat-value" style="font-family: monospace; font-size: 0.85em; color: var(--text-secondary);">${path}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <div class="merge-stats-table" style="margin-bottom: 1.5rem;">
                    <table>
                        <thead>
                            <tr>
                                <th colspan="2">Destination</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td class="stat-label">📂 ${this.getShortPath(this.destinationPath)}</td>
                                <td class="stat-value" style="font-family: monospace; font-size: 0.85em; color: var(--text-secondary);">${this.destinationPath}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="merge-stats-table" style="margin-bottom: 1.5rem;">
                    <table>
                        <thead>
                            <tr>
                                <th>Merge Statistics</th>
                                <th>Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td class="stat-label">Total files (all sources)</td>
                                <td class="stat-value">${this.mergePlan.totalFiles.toLocaleString()}</td>
                            </tr>
                            <tr>
                                <td class="stat-label">Duplicates removed</td>
                                <td class="stat-value">${this.mergePlan.duplicates.count.toLocaleString()}</td>
                            </tr>
                            <tr class="highlight">
                                <td class="stat-label">Final file count</td>
                                <td class="stat-value">${this.mergePlan.uniqueFiles.toLocaleString()}</td>
                            </tr>
                            <tr class="highlight">
                                <td class="stat-label">Total size</td>
                                <td class="stat-value">${this.formatBytes(this.mergePlan.totalBytes)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                ${spaceValidation ? `
                    <div class="merge-stats-table" style="margin-bottom: 1.5rem;">
                        <table>
                            <thead>
                                <tr>
                                    <th>Disk Space</th>
                                    <th>Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td class="stat-label">Required</td>
                                    <td class="stat-value">${spaceValidation.requiredFormatted}</td>
                                </tr>
                                <tr>
                                    <td class="stat-label">Available</td>
                                    <td class="stat-value">${spaceValidation.availableFormatted}</td>
                                </tr>
                                <tr class="${spaceValidation.hasEnoughSpace ? 'highlight' : ''}">
                                    <td class="stat-label">Status</td>
                                    <td class="stat-value" style="color: ${spaceValidation.hasEnoughSpace ? 'var(--success-color)' : 'var(--danger-color)'}">
                                        ${spaceValidation.hasEnoughSpace ? '✓ Sufficient space available' : '⚠️ Insufficient disk space!'}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                ` : ''}

                <div class="merge-stats-table">
                    <table>
                        <thead>
                            <tr>
                                <th colspan="2">Conflict Resolution Strategy</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td colspan="2" style="padding-left: 1rem;">When files with the same path exist in multiple libraries:</td>
                            </tr>
                            <tr>
                                <td colspan="2" style="padding-left: 2rem;">• The <strong>newer version</strong> (by modification date) will be kept</td>
                            </tr>
                            <tr>
                                <td colspan="2" style="padding-left: 2rem;">• All unique files from all libraries will be preserved</td>
                            </tr>
                            <tr>
                                <td colspan="2" style="padding-left: 2rem;">• No source libraries will be modified (read-only operation)</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="confirmation-actions" style="margin-top: 2rem; display: flex; justify-content: space-between; align-items: center;">
                    <button class="btn btn-secondary" onclick="mergeWizard.previousStep()">
                        ← Back to Preview
                    </button>
                    <button class="btn btn-primary" id="startMergeBtn"
                            ${spaceValidation && !spaceValidation.hasEnoughSpace ? 'disabled' : ''}>
                        Start Merge →
                    </button>
                </div>
            </div>
        `;

        const startBtn = document.getElementById('startMergeBtn');
        if (startBtn && (!spaceValidation || spaceValidation.hasEnoughSpace)) {
            startBtn.addEventListener('click', () => this.startMerge());
        }
    }

    // ========================================================================
    // Step 5: Merge Progress
    // ========================================================================

    renderStep5_MergeProgress() {
        const content = document.getElementById('mergeWizardContent');
        content.innerHTML = `
            <div class="wizard-step-content">
                <h3>Merging Libraries...</h3>

                <div class="progress-container">
                    <div class="progress-bar">
                        <div class="progress-fill" id="mergeProgressBar" style="width: 0%"></div>
                    </div>
                    <div class="progress-percentage" id="mergeProgressPercentage">0%</div>
                </div>

                <div class="progress-details">
                    <div class="current-file" id="mergeCurrentFile">
                        Starting merge...
                    </div>
                    <div class="progress-stats">
                        <div class="stat">
                            <span class="label">Files:</span>
                            <span class="value" id="mergeFilesProgress">0 / 0</span>
                        </div>
                        <div class="stat">
                            <span class="label">Size:</span>
                            <span class="value" id="mergeBytesProgress">0 / 0</span>
                        </div>
                        <div class="stat">
                            <span class="label">Speed:</span>
                            <span class="value" id="mergeSpeed">-</span>
                        </div>
                        <div class="stat">
                            <span class="label">Time Remaining:</span>
                            <span class="value" id="mergeETA">-</span>
                        </div>
                    </div>
                </div>

                <div class="merge-actions">
                    <button class="btn btn-danger" id="cancelMergeBtn">
                        Cancel Merge
                    </button>
                </div>

                <div id="mergeCompletionSection" style="display: none;">
                    <div class="completion-message">
                        <h4>Merge Complete!</h4>
                        <p id="mergeCompletionSummary"></p>
                    </div>
                    <div class="completion-actions">
                        <button class="btn btn-primary" id="validateMergeBtn">
                            Validate Transfer →
                        </button>
                        <button class="btn btn-secondary" id="skipValidationBtn">
                            Skip to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        `;

        const cancelBtn = document.getElementById('cancelMergeBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.cancelMerge());
        }
    }

    async startMerge() {
        // Move to progress step
        await this.renderStep(5);

        try {
            const response = await fetch('/api/merge/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourcePaths: this.sourcePaths,
                    destinationPath: this.destinationPath,
                    mergePlan: this.mergePlan,
                    socketId: app.socket.id
                })
            });

            const result = await response.json();

            if (result.success) {
                this.operationId = result.operationId;
                console.log('Merge started:', result.operationId);
            } else {
                throw new Error(result.error || 'Failed to start merge');
            }
        } catch (error) {
            console.error('Error starting merge:', error);
            app.showModal('Error', `Failed to start merge: ${error.message}`);
        }
    }

    handleProgressUpdate(data) {
        const progressBar = document.getElementById('mergeProgressBar');
        const progressPercentage = document.getElementById('mergeProgressPercentage');
        const currentFile = document.getElementById('mergeCurrentFile');
        const filesProgress = document.getElementById('mergeFilesProgress');
        const bytesProgress = document.getElementById('mergeBytesProgress');
        const speed = document.getElementById('mergeSpeed');
        const eta = document.getElementById('mergeETA');

        if (progressBar) progressBar.style.width = `${data.filesPercentage}%`;
        if (progressPercentage) progressPercentage.textContent = `${data.filesPercentage}%`;
        if (currentFile) currentFile.textContent = `Copying: ${data.currentFile}`;
        if (filesProgress) filesProgress.textContent = `${data.filesCopied} / ${data.totalFiles}`;
        if (bytesProgress) bytesProgress.textContent = `${this.formatBytes(data.bytesCopied)} / ${this.formatBytes(data.totalBytes)}`;
        if (speed) speed.textContent = data.speedFormatted || '-';
        if (eta) eta.textContent = data.timeRemainingFormatted || '-';
    }

    handleMergeComplete(data) {
        console.log('Merge complete:', data);

        const cancelBtn = document.getElementById('cancelMergeBtn');
        const completionSection = document.getElementById('mergeCompletionSection');
        const completionSummary = document.getElementById('mergeCompletionSummary');

        if (cancelBtn) cancelBtn.style.display = 'none';
        if (completionSection) completionSection.style.display = 'block';

        if (completionSummary) {
            completionSummary.innerHTML = `
                Successfully merged ${data.filesCopied} files (${this.formatBytes(data.bytesCopied)})
                in ${this.formatDuration(data.duration)}.
                ${data.errors && data.errors.length > 0
                    ? `<br><span class="warning">⚠️ ${data.errors.length} errors occurred during merge.</span>`
                    : ''}
            `;
        }

        // Add event listeners for completion actions
        const validateBtn = document.getElementById('validateMergeBtn');
        const skipBtn = document.getElementById('skipValidationBtn');

        if (validateBtn) {
            validateBtn.addEventListener('click', () => this.startValidation());
        }

        if (skipBtn) {
            skipBtn.addEventListener('click', () => this.skipToAnalysisDashboard());
        }
    }

    handleMergeError(data) {
        console.error('Merge error:', data);
        app.showModal('Error', `Merge failed: ${data.error}`);
    }

    handleMergeCancelled(data) {
        console.log('Merge cancelled:', data);
        app.showModal('Cancelled', 'Merge operation was cancelled.');
    }

    async cancelMerge() {
        try {
            const response = await fetch('/api/merge/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const result = await response.json();
            console.log('Cancel result:', result);
        } catch (error) {
            console.error('Error cancelling merge:', error);
        }
    }

    // ========================================================================
    // Step 6: Validation
    // ========================================================================

    renderStep6_Validation() {
        const content = document.getElementById('mergeWizardContent');
        content.innerHTML = `
            <div class="wizard-step-content">
                <h3>Validating Merged Library...</h3>

                <div class="progress-container">
                    <div class="progress-bar">
                        <div class="progress-fill" id="validateProgressBar" style="width: 0%"></div>
                    </div>
                    <div class="progress-percentage" id="validateProgressPercentage">0%</div>
                </div>

                <div class="validation-details">
                    <div class="validation-stats">
                        <div class="stat">
                            <span class="label">Files Validated:</span>
                            <span class="value" id="validateFilesProgress">0 / 0</span>
                        </div>
                        <div class="stat">
                            <span class="label">Issues Found:</span>
                            <span class="value" id="validateIssues">0</span>
                        </div>
                    </div>
                </div>

                <div id="validateResultsSection" style="display: none;">
                    <!-- Results will be populated here -->
                </div>
            </div>
        `;
    }

    async startValidation() {
        await this.renderStep(6);

        try {
            const response = await fetch('/api/merge/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    destinationPath: this.destinationPath,
                    mergePlan: this.mergePlan,
                    socketId: app.socket.id
                })
            });

            const result = await response.json();

            if (result.success) {
                console.log('Validation started:', result.operationId);
            } else {
                throw new Error(result.error || 'Failed to start validation');
            }
        } catch (error) {
            console.error('Error starting validation:', error);
            app.showModal('Error', `Failed to start validation: ${error.message}`);
        }
    }

    handleValidationProgress(data) {
        const progressBar = document.getElementById('validateProgressBar');
        const progressPercentage = document.getElementById('validateProgressPercentage');
        const filesProgress = document.getElementById('validateFilesProgress');
        const issues = document.getElementById('validateIssues');

        if (progressBar) progressBar.style.width = `${data.percentage}%`;
        if (progressPercentage) progressPercentage.textContent = `${data.percentage}%`;
        if (filesProgress) filesProgress.textContent = `${data.filesValidated} / ${data.totalFiles}`;
        if (issues) {
            issues.textContent = data.mismatches;
            issues.className = data.mismatches > 0 ? 'value error' : 'value success';
        }
    }

    handleValidationComplete(data) {
        console.log('Validation complete:', data);

        const resultsSection = document.getElementById('validateResultsSection');
        if (!resultsSection) return;

        resultsSection.style.display = 'block';

        if (data.isValid) {
            resultsSection.innerHTML = `
                <div class="validation-success">
                    <div class="success-icon">✓</div>
                    <h4>Validation Successful!</h4>
                    <p>All ${data.filesValidated} files verified successfully.</p>
                    <p>Validation completed in ${this.formatDuration(data.duration)}.</p>
                    <button class="btn btn-primary" id="viewDashboardBtn">
                        View Dashboard
                    </button>
                </div>
            `;
        } else {
            resultsSection.innerHTML = `
                <div class="validation-failure">
                    <div class="error-icon">⚠️</div>
                    <h4>Validation Failed</h4>
                    <p>${data.mismatches.length} files failed validation.</p>
                    ${data.mismatches.length > 0 ? `
                        <div class="mismatch-list">
                            <h5>Issues:</h5>
                            <ul>
                                ${data.mismatches.slice(0, 50).map(m => `
                                    <li>
                                        <strong>${m.file}</strong>: ${m.message}
                                    </li>
                                `).join('')}
                            </ul>
                            ${data.mismatches.length > 50 ? `
                                <p class="text-muted">... and ${data.mismatches.length - 50} more issues</p>
                            ` : ''}
                        </div>
                    ` : ''}
                    <div class="validation-actions">
                        <button class="btn btn-secondary" onclick="mergeWizard.skipToAnalysisDashboard()">
                            View Dashboard Anyway
                        </button>
                    </div>
                </div>
            `;
        }

        const viewBtn = document.getElementById('viewDashboardBtn');
        if (viewBtn) {
            viewBtn.addEventListener('click', () => this.skipToAnalysisDashboard());
        }
    }

    handleValidationError(data) {
        console.error('Validation error:', data);
        app.showModal('Error', `Validation failed: ${data.error}`);
    }

    async skipToAnalysisDashboard() {
        // Analyze the merged library and display dashboard
        try {
            const response = await fetch(`/api/analyze?path=${encodeURIComponent(this.destinationPath)}`);
            const result = await response.json();

            if (result.success) {
                // Update app state
                app.currentDirectory = this.destinationPath;

                // Display dashboard
                if (window.dashboard) {
                    window.dashboard.displayResults(result);
                    app.showScreen('dashboardScreen');
                }
            } else {
                throw new Error(result.error || 'Analysis failed');
            }
        } catch (error) {
            console.error('Error analyzing merged library:', error);
            app.showModal('Error', `Failed to analyze merged library: ${error.message}`);
        }
    }

    // ========================================================================
    // Folder Browser (reused from import wizard)
    // ========================================================================

    async showFolderBrowser(title = 'Select Folder') {
        return new Promise((resolve) => {
            this.folderBrowserResolve = resolve;

            const modalBody = `
                <div class="folder-browser">
                    <div class="current-path" id="currentBrowserPath" style="padding: 0.75rem; background: var(--bg-tertiary);
                         border-radius: 4px; margin-bottom: 1rem; font-family: monospace; font-size: 0.9em;">
                        Loading...
                    </div>
                    <div class="folder-list" id="folderListContent" style="max-height: 400px; overflow-y: auto;
                         border: 1px solid var(--border-color); border-radius: 4px;">
                        <div style="padding: 2rem; text-align: center; color: var(--text-secondary);">
                            Loading directories...
                        </div>
                    </div>
                </div>
            `;

            const selectCallback = () => {
                if (this.currentBrowsePath) {
                    resolve(this.currentBrowsePath);
                } else {
                    app.showModal('Error', 'Please select a folder first by clicking on a drive or directory.');
                }
            };

            app.showModal(title, modalBody, selectCallback, 'Select This Folder');

            // Override cancel button to resolve with null
            setTimeout(() => {
                const cancelBtn = document.getElementById('modalCancel');
                if (cancelBtn) {
                    const newCancelBtn = cancelBtn.cloneNode(true);
                    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
                    newCancelBtn.addEventListener('click', () => {
                        resolve(null);
                        app.hideModal();
                    });
                }
            }, 100);

            this.loadDrivesForBrowser();
        });
    }

    async loadDrivesForBrowser() {
        try {
            const response = await fetch('/api/browse/drives');
            const result = await response.json();

            if (result.success) {
                this.renderDriveList(result.drives, result.commonPaths);
            }
        } catch (error) {
            console.error('Error loading drives:', error);
        }
    }

    renderDriveList(drives, commonPaths) {
        const pathDiv = document.getElementById('currentBrowserPath');
        const listDiv = document.getElementById('folderListContent');

        if (pathDiv) pathDiv.textContent = 'Select a drive or common location';

        if (listDiv) {
            listDiv.innerHTML = drives.map(drive => `
                <div class="folder-item" data-path="${drive.path}" style="padding: 0.75rem; cursor: pointer;
                     border-bottom: 1px solid var(--border-color); transition: background 0.2s;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span>💾</span>
                        <span>${drive.name} (${drive.path})</span>
                    </div>
                </div>
            `).join('');

            // Add event listeners to each folder item
            listDiv.querySelectorAll('.folder-item').forEach(item => {
                item.addEventListener('click', () => {
                    const drivePath = item.getAttribute('data-path');
                    this.browsePath(drivePath);
                });

                // Add hover effect
                item.addEventListener('mouseenter', function() {
                    this.style.background = 'var(--bg-tertiary)';
                });
                item.addEventListener('mouseleave', function() {
                    this.style.background = 'transparent';
                });
            });
        }
    }

    async browsePath(path) {
        this.currentBrowsePath = path;

        try {
            const response = await fetch(`/api/browse/directory?path=${encodeURIComponent(path)}`);
            const result = await response.json();

            if (result.success) {
                this.renderDirectoryContents(result.directories, path);
            }
        } catch (error) {
            console.error('Error browsing path:', error);
        }
    }

    renderDirectoryContents(directories, currentPath) {
        const pathDiv = document.getElementById('currentBrowserPath');
        const listDiv = document.getElementById('folderListContent');

        if (pathDiv) pathDiv.textContent = currentPath;

        if (listDiv) {
            let html = '';

            // Add "up" button
            const parentPath = currentPath.split('\\').slice(0, -1).join('\\');
            if (parentPath) {
                html += `
                    <div class="folder-item" data-path="${parentPath}" style="padding: 0.75rem; cursor: pointer;
                         border-bottom: 1px solid var(--border-color); transition: background 0.2s;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span>⬆️</span>
                            <span>..</span>
                        </div>
                    </div>
                `;
            }

            // Add directories
            if (directories && directories.length > 0) {
                html += directories.map(dir => `
                    <div class="folder-item" data-path="${dir.path}" style="padding: 0.75rem; cursor: pointer;
                         border-bottom: 1px solid var(--border-color); transition: background 0.2s;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span>📁</span>
                            <span>${dir.name}</span>
                        </div>
                    </div>
                `).join('');
            } else {
                html += '<div style="padding: 1rem; text-align: center; color: var(--text-secondary);">No subdirectories found</div>';
            }

            listDiv.innerHTML = html;

            // Add event listeners to each folder item
            listDiv.querySelectorAll('.folder-item').forEach(item => {
                item.addEventListener('click', () => {
                    const dirPath = item.getAttribute('data-path');
                    this.browsePath(dirPath);
                });

                // Add hover effect
                item.addEventListener('mouseenter', function() {
                    this.style.background = 'var(--bg-tertiary)';
                });
                item.addEventListener('mouseleave', function() {
                    this.style.background = 'transparent';
                });
            });
        }
    }

    // ========================================================================
    // Utility Functions
    // ========================================================================

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatDuration(ms) {
        if (ms === 0) return '0s';

        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    getShortPath(fullPath) {
        const parts = fullPath.split('\\');
        if (parts.length > 3) {
            return '..\\' + parts.slice(-2).join('\\');
        }
        return fullPath;
    }
}

// Create global instance when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Instance will be created when merge mode is selected
    console.log('MergeWizard script loaded');
});
