const fs = require('fs-extra');
const path = require('path');

class MergeService {
    constructor(io, config) {
        this.io = io;
        this.config = config;
        this.currentOperation = null;
        this.cancelled = false;
        this.lastProgressEmit = 0;
        this.progressEmitInterval = 500; // Emit progress every 500ms (match ImportService)
        this.progressSamples = []; // For speed calculation
        this.sampleWindow = 5000; // 5 seconds window for speed calculation
    }

    /**
     * Analyze multiple source libraries and build merge plan
     * @param {Array<string>} sourcePaths - Array of source library paths
     * @param {string} destinationPath - Destination path for merged library
     * @returns {Promise<Object>} Analysis result with merge plan
     */
    async analyzeSources(sourcePaths, destinationPath) {
        console.log(`\n===== MERGE ANALYSIS =====`);
        console.log(`Sources: ${sourcePaths.length} libraries`);
        sourcePaths.forEach((src, i) => console.log(`  [${i + 1}] ${src}`));
        console.log(`Destination: ${destinationPath}`);

        try {
            // Build file inventory from all sources
            const inventory = await this.buildFileInventory(sourcePaths);
            console.log(`Total unique relative paths: ${inventory.size}`);

            // Resolve conflicts (select which version to keep)
            const resolutionPlan = this.resolveConflicts(inventory);

            // Calculate statistics
            const mergePlan = this.buildMergePlan(inventory, resolutionPlan, sourcePaths);

            console.log(`\nMerge Plan Summary:`);
            console.log(`  Total files from all sources: ${mergePlan.totalFiles}`);
            console.log(`  Unique files (after deduplication): ${mergePlan.uniqueFiles}`);
            console.log(`  Duplicates detected: ${mergePlan.duplicates.count}`);
            console.log(`  Conflicts resolved: ${mergePlan.conflicts.count}`);
            console.log(`  Total bytes to copy: ${this.formatBytes(mergePlan.totalBytes)}`);

            return mergePlan;
        } catch (error) {
            console.error('Error analyzing sources:', error);
            throw error;
        }
    }

    /**
     * Build unified file inventory from all sources
     * @param {Array<string>} sourcePaths - Array of source library paths
     * @returns {Promise<Map>} Map of relativePath -> Array of file candidates
     */
    async buildFileInventory(sourcePaths) {
        const inventory = new Map();

        for (let i = 0; i < sourcePaths.length; i++) {
            const sourcePath = sourcePaths[i];
            console.log(`\nScanning source [${i + 1}/${sourcePaths.length}]: ${sourcePath}`);

            try {
                // Recursively scan this source library
                const files = await this.scanDirectory(sourcePath, sourcePath);

                console.log(`  Found ${files.length} files`);

                // Add each file to inventory
                for (const file of files) {
                    const relativePath = file.relativePath;

                    if (!inventory.has(relativePath)) {
                        inventory.set(relativePath, []);
                    }

                    // Get file stats
                    try {
                        const stats = await fs.stat(file.sourcePath);

                        inventory.get(relativePath).push({
                            sourcePath: file.sourcePath,
                            sourceLibrary: sourcePath,
                            relativePath: relativePath,
                            size: stats.size,
                            mtime: stats.mtime,
                            selected: false // Will be set during conflict resolution
                        });
                    } catch (statError) {
                        console.warn(`  Warning: Could not stat file ${file.sourcePath}:`, statError.message);
                    }
                }
            } catch (error) {
                console.error(`  Error scanning source ${sourcePath}:`, error);
                throw error;
            }
        }

        return inventory;
    }

    /**
     * Recursively scan directory for files
     * @param {string} dirPath - Directory to scan
     * @param {string} basePath - Base path for calculating relative paths
     * @returns {Promise<Array>} Array of file objects with sourcePath and relativePath
     */
    async scanDirectory(dirPath, basePath) {
        const files = [];

        async function scan(currentPath) {
            try {
                const items = await fs.readdir(currentPath);

                for (const item of items) {
                    const itemPath = path.join(currentPath, item);
                    const stats = await fs.stat(itemPath);

                    if (stats.isDirectory()) {
                        // Recursively scan subdirectory
                        await scan(itemPath);
                    } else if (stats.isFile()) {
                        const relativePath = path.relative(basePath, itemPath);
                        files.push({
                            sourcePath: itemPath,
                            relativePath: relativePath
                        });
                    }
                }
            } catch (error) {
                console.warn(`Warning: Could not scan directory ${currentPath}:`, error.message);
            }
        }

        await scan(dirPath);
        return files;
    }

    /**
     * Resolve conflicts by selecting which version of each file to keep
     * @param {Map} inventory - File inventory map
     * @returns {Object} Resolution statistics
     */
    resolveConflicts(inventory) {
        const resolutions = [];
        let duplicateCount = 0;
        let conflictCount = 0;

        for (const [relativePath, candidates] of inventory) {
            if (candidates.length === 1) {
                // Only one version exists - no conflict
                candidates[0].selected = true;
            } else {
                // Multiple versions exist - duplicate detected
                duplicateCount++;

                // Check if files are actually different (conflict)
                const hasConflict = this.hasConflict(candidates);

                if (hasConflict) {
                    conflictCount++;
                }

                // Select the newest version (by mtime)
                let newestCandidate = candidates[0];
                for (const candidate of candidates) {
                    if (candidate.mtime > newestCandidate.mtime) {
                        newestCandidate = candidate;
                    }
                }

                // Mark the newest as selected
                newestCandidate.selected = true;

                // Record resolution if there was a conflict
                if (hasConflict && resolutions.length < 50) {
                    // Only store first 50 for preview
                    resolutions.push({
                        relativePath: relativePath,
                        winningSource: newestCandidate.sourceLibrary,
                        winningMtime: newestCandidate.mtime,
                        candidates: candidates.map(c => ({
                            source: c.sourceLibrary,
                            size: c.size,
                            mtime: c.mtime,
                            selected: c.selected
                        })),
                        reason: `newer (${this.formatDate(newestCandidate.mtime)})`
                    });
                }
            }
        }

        return {
            duplicateCount,
            conflictCount,
            resolutions
        };
    }

    /**
     * Check if candidates have actual differences (not just duplicates)
     * @param {Array} candidates - Array of file candidates
     * @returns {boolean} True if files differ in size or mtime
     */
    hasConflict(candidates) {
        if (candidates.length <= 1) return false;

        const firstSize = candidates[0].size;
        const firstMtime = candidates[0].mtime.getTime();

        for (let i = 1; i < candidates.length; i++) {
            if (candidates[i].size !== firstSize ||
                candidates[i].mtime.getTime() !== firstMtime) {
                return true;
            }
        }

        return false;
    }

    /**
     * Build complete merge plan with all statistics
     * @param {Map} inventory - File inventory
     * @param {Object} resolutionPlan - Conflict resolution results
     * @param {Array<string>} sourcePaths - Source library paths
     * @returns {Object} Complete merge plan
     */
    buildMergePlan(inventory, resolutionPlan, sourcePaths) {
        const filesToCopy = [];
        const sourceStats = {};

        // Initialize source stats
        for (const sourcePath of sourcePaths) {
            sourceStats[sourcePath] = { files: 0, bytes: 0 };
        }

        let totalFiles = 0;
        let totalBytes = 0;
        let uniqueFiles = 0;

        // Build list of files to copy and calculate stats
        for (const [relativePath, candidates] of inventory) {
            totalFiles += candidates.length;

            // Find selected candidate
            const selected = candidates.find(c => c.selected);

            if (selected) {
                uniqueFiles++;
                totalBytes += selected.size;

                filesToCopy.push({
                    sourcePath: selected.sourcePath,
                    sourceLibrary: selected.sourceLibrary,
                    relativePath: relativePath,
                    size: selected.size,
                    mtime: selected.mtime
                });

                // Update source stats for original source
                for (const candidate of candidates) {
                    sourceStats[candidate.sourceLibrary].files++;
                    sourceStats[candidate.sourceLibrary].bytes += candidate.size;
                }
            }
        }

        // Generate duplicate examples for preview
        const duplicateExamples = [];
        let exampleCount = 0;

        for (const [relativePath, candidates] of inventory) {
            if (candidates.length > 1 && exampleCount < 10) {
                duplicateExamples.push({
                    relativePath,
                    count: candidates.length,
                    sources: candidates.map(c => c.sourceLibrary)
                });
                exampleCount++;
            }
        }

        return {
            totalFiles,
            totalBytes,
            uniqueFiles,
            sourceStats,
            duplicates: {
                count: resolutionPlan.duplicateCount,
                examples: duplicateExamples
            },
            conflicts: {
                count: resolutionPlan.conflictCount,
                resolutions: resolutionPlan.resolutions
            },
            filesToCopy
        };
    }

    /**
     * Execute merge operation with progress tracking
     * @param {Array<string>} sourcePaths - Source library paths
     * @param {string} destinationPath - Destination library path
     * @param {Object} mergePlan - Pre-computed merge plan
     * @param {string} socketId - Socket.IO client ID
     * @param {string} operationId - Operation ID
     */
    async executeMerge(sourcePaths, destinationPath, mergePlan, socketId, operationId) {
        this.cancelled = false;
        this.currentOperation = { sourcePaths, destinationPath, mergePlan, socketId, operationId };
        this.progressSamples = [];

        const startTime = Date.now();
        const { filesToCopy, totalBytes } = mergePlan;

        console.log(`\n===== EXECUTING MERGE =====`);
        console.log(`Files to copy: ${filesToCopy.length}`);
        console.log(`Total bytes: ${this.formatBytes(totalBytes)}`);

        let filesCopied = 0;
        let bytesCopied = 0;
        const errors = [];

        try {
            // Group files by source library for organized progress display
            const filesBySource = {};
            for (const file of filesToCopy) {
                if (!filesBySource[file.sourceLibrary]) {
                    filesBySource[file.sourceLibrary] = [];
                }
                filesBySource[file.sourceLibrary].push(file);
            }

            // Copy files
            for (const file of filesToCopy) {
                // Check for cancellation
                if (this.cancelled) {
                    console.log('Merge cancelled by user');
                    this.emitEvent(socketId, 'merge:cancelled', {
                        filesCopied,
                        bytesCopied,
                        totalFiles: filesToCopy.length,
                        totalBytes,
                        operationId
                    });
                    return { success: false, cancelled: true };
                }

                const destPath = path.join(destinationPath, file.relativePath);

                try {
                    // Ensure destination directory exists
                    await fs.ensureDir(path.dirname(destPath));

                    // Copy file with progress callback
                    await this.copyFileWithProgress(
                        file.sourcePath,
                        destPath,
                        (currentBytes, totalFileBytes) => {
                            // File-level progress (not emitted individually to avoid spam)
                        }
                    );

                    bytesCopied += file.size;
                    filesCopied++;

                    // Emit progress after each file
                    this.emitProgress(socketId, {
                        status: 'copying',
                        currentFile: file.relativePath,
                        currentSource: file.sourceLibrary,
                        filesCopied,
                        totalFiles: filesToCopy.length,
                        filesPercentage: Math.round((filesCopied / filesToCopy.length) * 100),
                        bytesCopied,
                        totalBytes,
                        bytesPercentage: Math.round((bytesCopied / totalBytes) * 100),
                        operationId
                    });

                } catch (error) {
                    console.error(`Error copying file ${file.relativePath}:`, error.message);
                    errors.push({
                        file: file.relativePath,
                        error: error.message
                    });
                }
            }

            // Calculate duration
            const duration = Date.now() - startTime;

            console.log(`\nMerge completed:`);
            console.log(`  Files copied: ${filesCopied}`);
            console.log(`  Bytes copied: ${this.formatBytes(bytesCopied)}`);
            console.log(`  Duration: ${this.formatDuration(duration)}`);
            console.log(`  Errors: ${errors.length}`);

            // Emit completion event
            this.emitEvent(socketId, 'merge:complete', {
                success: true,
                filesCopied,
                bytesCopied,
                totalFiles: filesToCopy.length,
                totalBytes,
                duration,
                errors,
                operationId
            });

            // Clear current operation
            this.currentOperation = null;

            return {
                success: true,
                filesCopied,
                bytesCopied,
                errors
            };

        } catch (error) {
            console.error('Fatal error during merge:', error);
            this.emitEvent(socketId, 'merge:error', {
                error: error.message,
                operationId
            });
            throw error;
        }
    }

    /**
     * Copy file with progress tracking (stream-based)
     * @param {string} sourcePath - Source file path
     * @param {string} destPath - Destination file path
     * @param {Function} onProgress - Progress callback
     */
    async copyFileWithProgress(sourcePath, destPath, onProgress) {
        return new Promise((resolve, reject) => {
            const readStream = fs.createReadStream(sourcePath);
            const writeStream = fs.createWriteStream(destPath);

            const stats = fs.statSync(sourcePath);
            const totalBytes = stats.size;
            let copiedBytes = 0;

            readStream.on('data', (chunk) => {
                copiedBytes += chunk.length;
                if (onProgress) {
                    onProgress(copiedBytes, totalBytes);
                }
            });

            readStream.on('error', (err) => {
                writeStream.destroy();
                reject(err);
            });

            writeStream.on('error', (err) => {
                readStream.destroy();
                reject(err);
            });

            writeStream.on('finish', () => {
                resolve();
            });

            readStream.pipe(writeStream);
        });
    }

    /**
     * Validate merged library integrity
     * @param {string} destinationPath - Destination library path
     * @param {Object} mergePlan - Merge plan with expected files
     * @param {string} socketId - Socket.IO client ID
     * @param {string} operationId - Operation ID
     */
    async validateMerge(destinationPath, mergePlan, socketId, operationId) {
        console.log(`\n===== VALIDATING MERGE =====`);
        console.log(`Destination: ${destinationPath}`);
        console.log(`Expected files: ${mergePlan.filesToCopy.length}`);

        const startTime = Date.now();
        const mismatches = [];
        let filesValidated = 0;

        try {
            const { filesToCopy } = mergePlan;

            for (const file of filesToCopy) {
                const destPath = path.join(destinationPath, file.relativePath);

                try {
                    // Check if file exists
                    const exists = await fs.pathExists(destPath);

                    if (!exists) {
                        mismatches.push({
                            file: file.relativePath,
                            issue: 'missing',
                            message: 'File does not exist in destination'
                        });
                    } else {
                        // Check file size
                        const stats = await fs.stat(destPath);

                        if (stats.size !== file.size) {
                            mismatches.push({
                                file: file.relativePath,
                                issue: 'size_mismatch',
                                message: `Size mismatch: expected ${file.size}, got ${stats.size}`
                            });
                        }
                    }
                } catch (error) {
                    mismatches.push({
                        file: file.relativePath,
                        issue: 'error',
                        message: error.message
                    });
                }

                filesValidated++;

                // Emit progress every 100 files
                if (filesValidated % 100 === 0 || filesValidated === filesToCopy.length) {
                    this.emitEvent(socketId, 'validate:progress', {
                        status: 'validating',
                        filesValidated,
                        totalFiles: filesToCopy.length,
                        percentage: Math.round((filesValidated / filesToCopy.length) * 100),
                        mismatches: mismatches.length,
                        operationId
                    });
                }
            }

            const duration = Date.now() - startTime;
            const isValid = mismatches.length === 0;

            console.log(`\nValidation completed:`);
            console.log(`  Files validated: ${filesValidated}`);
            console.log(`  Mismatches: ${mismatches.length}`);
            console.log(`  Duration: ${this.formatDuration(duration)}`);

            // Emit completion event
            this.emitEvent(socketId, 'validate:complete', {
                isValid,
                filesValidated,
                mismatches: mismatches.slice(0, 50), // Only send first 50
                duration,
                operationId
            });

        } catch (error) {
            console.error('Error during validation:', error);
            this.emitEvent(socketId, 'validate:error', {
                error: error.message,
                operationId
            });
            throw error;
        }
    }

    /**
     * Cancel ongoing merge operation
     */
    async cancelMerge() {
        console.log('Cancelling merge operation...');
        this.cancelled = true;
        return { success: true, message: 'Merge cancelled' };
    }

    /**
     * Emit progress event with throttling
     * @param {string} socketId - Socket.IO client ID
     * @param {Object} progressData - Progress data to emit
     */
    emitProgress(socketId, progressData) {
        const now = Date.now();

        // Throttle emissions to max every 500ms
        if (now - this.lastProgressEmit < this.progressEmitInterval) {
            return;
        }

        this.lastProgressEmit = now;

        // Add progress sample for speed calculation
        this.addProgressSample(progressData.bytesCopied);

        // Calculate speed and ETA
        const speed = this.calculateSpeed();
        const eta = this.calculateETA(progressData.bytesCopied, progressData.totalBytes);

        // Emit progress event
        this.emitEvent(socketId, 'merge:progress', {
            ...progressData,
            speed,
            speedFormatted: this.formatSpeed(speed),
            timeRemaining: eta,
            timeRemainingFormatted: this.formatDuration(eta),
            timestamp: now
        });
    }

    /**
     * Emit Socket.IO event
     * @param {string} socketId - Socket.IO client ID
     * @param {string} event - Event name
     * @param {Object} data - Event data
     */
    emitEvent(socketId, event, data) {
        if (this.io && socketId) {
            this.io.to(socketId).emit(event, data);
        }
    }

    /**
     * Add progress sample for speed calculation
     * @param {number} bytesCopied - Bytes copied so far
     */
    addProgressSample(bytesCopied) {
        const now = Date.now();
        this.progressSamples.push({ timestamp: now, bytes: bytesCopied });

        // Remove samples older than window
        this.progressSamples = this.progressSamples.filter(
            sample => now - sample.timestamp <= this.sampleWindow
        );
    }

    /**
     * Calculate current transfer speed
     * @returns {number} Speed in bytes per second
     */
    calculateSpeed() {
        if (this.progressSamples.length < 2) return 0;

        const oldest = this.progressSamples[0];
        const newest = this.progressSamples[this.progressSamples.length - 1];

        const timeDiff = (newest.timestamp - oldest.timestamp) / 1000; // seconds
        const bytesDiff = newest.bytes - oldest.bytes;

        return timeDiff > 0 ? bytesDiff / timeDiff : 0;
    }

    /**
     * Calculate estimated time remaining
     * @param {number} bytesCopied - Bytes copied so far
     * @param {number} totalBytes - Total bytes to copy
     * @returns {number} ETA in milliseconds
     */
    calculateETA(bytesCopied, totalBytes) {
        const speed = this.calculateSpeed();
        if (speed === 0) return 0;

        const bytesRemaining = totalBytes - bytesCopied;
        return (bytesRemaining / speed) * 1000; // milliseconds
    }

    /**
     * Format bytes to human-readable string
     * @param {number} bytes - Bytes to format
     * @returns {string} Formatted string
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Format speed to human-readable string
     * @param {number} bytesPerSecond - Speed in bytes per second
     * @returns {string} Formatted string
     */
    formatSpeed(bytesPerSecond) {
        return this.formatBytes(bytesPerSecond) + '/s';
    }

    /**
     * Format duration to human-readable string
     * @param {number} ms - Duration in milliseconds
     * @returns {string} Formatted string
     */
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

    /**
     * Format date to human-readable string
     * @param {Date} date - Date to format
     * @returns {string} Formatted string
     */
    formatDate(date) {
        return date.toISOString().split('T')[0]; // YYYY-MM-DD
    }
}

module.exports = MergeService;
