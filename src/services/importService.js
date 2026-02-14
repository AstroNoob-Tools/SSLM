const fs = require('fs-extra');
const path = require('path');
const DirectoryBrowser = require('../utils/directoryBrowser');
const DiskSpaceValidator = require('../utils/diskSpaceValidator');

class ImportService {
    constructor(io, config) {
        this.io = io;
        this.config = config;
        this.seestarDirectoryName = config?.seestar?.directoryName || 'MyWorks';
        this.currentOperation = null;
        this.cancelled = false;
        this.lastProgressEmit = 0;
        this.progressEmitInterval = 500; // Emit progress every 500ms
        this.progressSamples = []; // For speed calculation
        this.sampleWindow = 5000; // 5 seconds window for speed calculation
    }

    /**
     * Detect SeeStar devices (removable drives and network path)
     * @returns {Promise<Array>} Array of detected devices
     */
    async detectSeeStarDevices() {
        const devices = [];

        try {
            // Check removable drives - only include drives with SeeStar directory
            const drives = await DirectoryBrowser.getWindowsDrives();

            for (const drive of drives) {
                const seestarPath = path.join(drive.path, this.seestarDirectoryName);
                const hasSeestarDir = await fs.pathExists(seestarPath);

                // Only add drives that have SeeStar directory
                if (hasSeestarDir) {
                    devices.push({
                        path: drive.path,
                        type: 'removable',
                        hasMyWork: true,
                        label: `${drive.name} (SeeStar)`,
                        fullPath: seestarPath
                    });
                }
            }

            // Always include network path as an option
            const networkPath = '\\\\seestar';
            const networkSeestarPath = path.join(networkPath, this.seestarDirectoryName);

            try {
                const networkHasSeestarDir = await fs.pathExists(networkSeestarPath);
                devices.push({
                    path: networkPath,
                    type: 'network',
                    hasMyWork: networkHasSeestarDir,
                    label: networkHasSeestarDir ? 'Network (SeeStar)' : 'Network (not available)',
                    fullPath: networkHasSeestarDir ? networkSeestarPath : null
                });
            } catch (err) {
                // Network path not accessible
                devices.push({
                    path: networkPath,
                    type: 'network',
                    hasMyWork: false,
                    label: 'Network (not available)',
                    fullPath: null
                });
            }

            return devices;
        } catch (error) {
            console.error('Error detecting devices:', error);
            throw error;
        }
    }

    /**
     * Start import operation
     * @param {string} sourcePath - Source directory (MyWork folder)
     * @param {string} destinationPath - Destination directory
     * @param {string} strategy - 'full' or 'incremental'
     * @param {string} socketId - Socket.IO client ID for progress updates
     * @param {string} operationId - Unique operation ID
     */
    async startImport(sourcePath, destinationPath, strategy, socketId, operationId) {
        this.cancelled = false;
        this.currentOperation = { sourcePath, destinationPath, strategy, socketId, operationId };
        this.progressSamples = [];

        const startTime = Date.now();

        try {
            // Scan source directory for all files
            const allFiles = await this.scanDirectory(sourcePath);

            // Get file stats and filter based on strategy
            const filesToCopy = [];
            console.log(`\n===== INCREMENTAL COPY ANALYSIS (Strategy: ${strategy}) =====`);
            console.log(`Source: ${sourcePath}`);
            console.log(`Destination: ${destinationPath}`);
            console.log(`Total files found in source: ${allFiles.length}\n`);

            for (const file of allFiles) {
                try {
                    const stats = await fs.stat(file.sourcePath);
                    file.size = stats.size;

                    // For incremental, check if file needs to be copied
                    if (strategy === 'incremental') {
                        const shouldCopy = await this.shouldCopyFile(
                            file.sourcePath,
                            file.destPath,
                            strategy
                        );
                        if (shouldCopy) {
                            filesToCopy.push(file);
                        }
                    } else {
                        // For full copy, include all files
                        filesToCopy.push(file);
                    }
                } catch (err) {
                    console.warn(`Cannot stat file ${file.sourcePath}:`, err.message);
                }
            }

            console.log(`\n===== SUMMARY =====`);
            console.log(`Files to copy: ${filesToCopy.length}`);
            console.log(`Files to skip: ${allFiles.length - filesToCopy.length}\n`);


            // Calculate totals based on files that will actually be copied
            const totalFiles = filesToCopy.length;
            let totalBytes = 0;
            for (const file of filesToCopy) {
                totalBytes += file.size || 0;
            }

            // For incremental, calculate how many files are being skipped
            const initialFilesSkipped = strategy === 'incremental'
                ? allFiles.length - filesToCopy.length
                : 0;

            console.log(`Import ${strategy}: ${totalFiles} files to copy, ${initialFilesSkipped} files skipped (already up-to-date), ${totalBytes} bytes to transfer`);

            // Prepare progress tracker
            let filesCopied = 0;
            let filesSkipped = initialFilesSkipped;
            let bytesCopied = 0;
            const errors = [];

            // Ensure destination exists
            await fs.ensureDir(destinationPath);

            // Copy files (filesToCopy is already filtered based on strategy)
            for (const file of filesToCopy) {
                // Check cancellation
                if (this.cancelled) {
                    this.emitEvent(socketId, 'import:cancelled', {
                        operationId,
                        status: 'cancelled',
                        filesCopied,
                        filesSkipped,
                        totalFiles,
                        bytesCopied,
                        totalBytes,
                        timestamp: Date.now()
                    });
                    return { success: false, cancelled: true };
                }

                try {
                    // Ensure destination directory exists
                    await fs.ensureDir(path.dirname(file.destPath));

                    // Copy file with progress
                    await this.copyFileWithProgress(
                        file.sourcePath,
                        file.destPath,
                        (currentBytes, totalFileBytes) => {
                            const currentBytesCopied = bytesCopied + currentBytes;

                            this.emitProgress(socketId, {
                                operationId,
                                status: 'copying',
                                currentFile: file.relativePath,
                                filesCopied,
                                filesSkipped,
                                totalFiles,
                                filesPercentage: Math.round((filesCopied / totalFiles) * 100),
                                bytesCopied: currentBytesCopied,
                                totalBytes,
                                bytesPercentage: totalBytes > 0 ? Math.round((currentBytesCopied / totalBytes) * 100) : 0,
                                timestamp: Date.now()
                            });
                        }
                    );

                    bytesCopied += file.size || 0;
                    filesCopied++;

                    // Emit progress after each file
                    this.emitProgress(socketId, {
                        operationId,
                        status: 'copying',
                        currentFile: file.relativePath,
                        filesCopied,
                        filesSkipped,
                        totalFiles,
                        filesPercentage: Math.round((filesCopied / totalFiles) * 100),
                        bytesCopied,
                        totalBytes,
                        bytesPercentage: totalBytes > 0 ? Math.round((bytesCopied / totalBytes) * 100) : 0,
                        timestamp: Date.now()
                    });
                } catch (err) {
                    console.error(`Error copying ${file.sourcePath}:`, err);
                    errors.push({
                        file: file.relativePath,
                        error: err.message
                    });
                    filesSkipped++;
                }
            }

            // Calculate duration
            const duration = Date.now() - startTime;
            const durationFormatted = this.formatDuration(duration);

            // Emit completion
            this.emitEvent(socketId, 'import:complete', {
                operationId,
                status: 'completed',
                filesCopied,
                filesSkipped,
                totalFiles,
                bytesCopied,
                totalBytes,
                totalBytesFormatted: DiskSpaceValidator.formatBytes(bytesCopied),
                duration,
                durationFormatted,
                errors,
                timestamp: Date.now()
            });

            this.currentOperation = null;
            return { success: true, filesCopied, filesSkipped, errors };
        } catch (error) {
            console.error('Import error:', error);

            this.emitEvent(socketId, 'import:error', {
                operationId,
                status: 'error',
                error: error.message,
                timestamp: Date.now()
            });

            this.currentOperation = null;
            throw error;
        }
    }

    /**
     * Cancel current import operation
     */
    async cancelImport() {
        if (this.currentOperation) {
            this.cancelled = true;
            return { success: true, cancelled: true };
        }
        return { success: false, error: 'No active import operation' };
    }

    /**
     * Recursively scan directory for all files
     * @param {string} dirPath - Directory to scan
     * @param {string} basePath - Base path for relative paths (defaults to dirPath)
     * @param {string} destinationPath - Optional destination path (defaults to currentOperation destinationPath)
     * @returns {Promise<Array>} Array of file objects with source and dest paths
     */
    async scanDirectory(dirPath, basePath = null, destinationPath = null) {
        if (!basePath) {
            basePath = dirPath;
        }

        // Use provided destination path, or fall back to current operation's destination path
        const destBasePath = destinationPath || this.currentOperation?.destinationPath || '';

        const files = [];

        const scan = async (currentPath) => {
            try {
                const items = await fs.readdir(currentPath);

                for (const item of items) {
                    const itemPath = path.join(currentPath, item);

                    try {
                        const stats = await fs.stat(itemPath);

                        if (stats.isDirectory()) {
                            await scan(itemPath);
                        } else {
                            const relativePath = path.relative(basePath, itemPath);
                            const destPath = path.join(
                                destBasePath,
                                relativePath
                            );

                            files.push({
                                sourcePath: itemPath,
                                destPath,
                                relativePath,
                                size: stats.size
                            });
                        }
                    } catch (err) {
                        console.warn(`Cannot access ${itemPath}:`, err.message);
                    }
                }
            } catch (err) {
                console.warn(`Cannot read directory ${currentPath}:`, err.message);
            }
        };

        await scan(dirPath);
        return files;
    }

    /**
     * Copy a single file with progress tracking
     * @param {string} sourcePath - Source file path
     * @param {string} destPath - Destination file path
     * @param {Function} onProgress - Progress callback (currentBytes, totalBytes)
     */
    async copyFileWithProgress(sourcePath, destPath, onProgress) {
        return new Promise((resolve, reject) => {
            const readStream = fs.createReadStream(sourcePath);
            const writeStream = fs.createWriteStream(destPath);

            let copiedBytes = 0;
            let totalBytes = 0;

            // Get file size
            fs.stat(sourcePath)
                .then(stats => {
                    totalBytes = stats.size;
                })
                .catch(err => {
                    console.warn('Cannot get file size:', err);
                });

            readStream.on('data', chunk => {
                copiedBytes += chunk.length;
                if (onProgress) {
                    onProgress(copiedBytes, totalBytes);
                }
            });

            readStream.on('error', error => {
                writeStream.destroy();
                reject(error);
            });

            writeStream.on('error', error => {
                readStream.destroy();
                reject(error);
            });

            writeStream.on('finish', () => {
                resolve();
            });

            readStream.pipe(writeStream);
        });
    }

    /**
     * Determine if a file should be copied based on strategy
     * @param {string} sourceFile - Source file path
     * @param {string} destFile - Destination file path
     * @param {string} strategy - 'full' or 'incremental'
     * @returns {Promise<boolean>} True if file should be copied
     */
    async shouldCopyFile(sourceFile, destFile, strategy) {
        // Full copy: always copy
        if (strategy === 'full') {
            return true;
        }

        // Incremental: check if file exists and is up-to-date
        try {
            const destExists = await fs.pathExists(destFile);
            if (!destExists) {
                console.log(`[COPY] ${path.basename(sourceFile)} - destination doesn't exist`);
                return true; // File doesn't exist, copy it
            }

            // Compare file stats
            const sourceStats = await fs.stat(sourceFile);
            const destStats = await fs.stat(destFile);

            const sizeDiffers = sourceStats.size !== destStats.size;
            const sourceNewer = sourceStats.mtime > destStats.mtime;
            const shouldCopy = sizeDiffers || sourceNewer;

            if (shouldCopy) {
                const reason = sizeDiffers ?
                    `size differs (src: ${sourceStats.size}, dest: ${destStats.size})` :
                    `source newer (src: ${sourceStats.mtime.toISOString()}, dest: ${destStats.mtime.toISOString()})`;
                console.log(`[COPY] ${path.basename(sourceFile)} - ${reason}`);
            } else {
                console.log(`[SKIP] ${path.basename(sourceFile)} - identical (size: ${sourceStats.size}, mtime: ${destStats.mtime.toISOString()})`);
            }

            return shouldCopy;
        } catch (err) {
            // If error checking, assume we should copy
            console.log(`[COPY] ${path.basename(sourceFile)} - error checking, copying anyway: ${err.message}`);
            return true;
        }
    }

    /**
     * Emit progress update with throttling
     * @param {string} socketId - Socket ID
     * @param {Object} progressData - Progress data
     */
    emitProgress(socketId, progressData) {
        const now = Date.now();

        // Add sample for speed calculation
        this.addProgressSample(progressData.bytesCopied);

        // Calculate speed and ETA
        const speed = this.calculateSpeed();
        const eta = this.calculateETA(progressData.bytesCopied, progressData.totalBytes);

        const enrichedData = {
            ...progressData,
            speed,
            speedFormatted: DiskSpaceValidator.formatBytes(speed) + '/s',
            timeRemaining: eta,
            timeRemainingFormatted: this.formatDuration(eta * 1000)
        };

        // Throttle emission
        if (now - this.lastProgressEmit >= this.progressEmitInterval) {
            this.emitEvent(socketId, 'import:progress', enrichedData);
            this.lastProgressEmit = now;
        }
    }

    /**
     * Emit Socket.IO event
     * @param {string} socketId - Socket ID
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

        // Remove old samples outside window
        this.progressSamples = this.progressSamples.filter(
            sample => now - sample.timestamp <= this.sampleWindow
        );
    }

    /**
     * Calculate current transfer speed (bytes per second)
     * @returns {number} Speed in bytes per second
     */
    calculateSpeed() {
        if (this.progressSamples.length < 2) {
            return 0;
        }

        const oldest = this.progressSamples[0];
        const newest = this.progressSamples[this.progressSamples.length - 1];

        const timeDiff = (newest.timestamp - oldest.timestamp) / 1000; // seconds
        const bytesDiff = newest.bytes - oldest.bytes;

        return timeDiff > 0 ? Math.round(bytesDiff / timeDiff) : 0;
    }

    /**
     * Calculate estimated time remaining (in seconds)
     * @param {number} bytesCopied - Bytes copied so far
     * @param {number} totalBytes - Total bytes to copy
     * @returns {number} ETA in seconds (or null if cannot calculate)
     */
    calculateETA(bytesCopied, totalBytes) {
        const speed = this.calculateSpeed();
        if (speed === 0 || totalBytes === 0) {
            return null;
        }

        const bytesRemaining = totalBytes - bytesCopied;
        return Math.round(bytesRemaining / speed);
    }

    /**
     * Format duration in milliseconds to human-readable string
     * @param {number} ms - Duration in milliseconds
     * @returns {string} Formatted duration (e.g., "5m 34s")
     */
    formatDuration(ms) {
        if (!ms || ms < 0) return '0s';

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
     * Validate transfer integrity - verify all source files exist in destination with correct size
     * @param {string} sourcePath - Source directory (MyWorks folder)
     * @param {string} destinationPath - Destination directory
     * @param {string} socketId - Socket.IO client ID for progress updates
     * @param {string} operationId - Unique operation ID
     * @returns {Promise<Object>} Validation result with mismatches
     */
    async validateTransfer(sourcePath, destinationPath, socketId, operationId) {
        const startTime = Date.now();

        try {
            console.log(`Starting transfer validation: ${sourcePath} -> ${destinationPath}`);

            // Scan source directory
            this.emitEvent(socketId, 'validate:progress', {
                operationId,
                status: 'scanning',
                message: 'Scanning source files...',
                timestamp: Date.now()
            });

            // Pass destinationPath explicitly since currentOperation is null after import completes
            const sourceFiles = await this.scanDirectory(sourcePath, null, destinationPath);
            const totalFiles = sourceFiles.length;

            console.log(`Validating ${totalFiles} files from ${sourcePath} against ${destinationPath}...`);

            const mismatches = [];
            let filesValidated = 0;

            // Validate each file
            for (const file of sourceFiles) {
                try {
                    const sourceStats = await fs.stat(file.sourcePath);
                    const destExists = await fs.pathExists(file.destPath);

                    if (!destExists) {
                        // File missing in destination
                        mismatches.push({
                            file: file.relativePath,
                            issue: 'missing',
                            message: 'File does not exist in destination'
                        });
                    } else {
                        // File exists, check size
                        const destStats = await fs.stat(file.destPath);

                        if (sourceStats.size !== destStats.size) {
                            // Size mismatch - incomplete copy
                            mismatches.push({
                                file: file.relativePath,
                                issue: 'size_mismatch',
                                message: `Size mismatch: source ${sourceStats.size} bytes, destination ${destStats.size} bytes`
                            });
                        }
                    }

                    filesValidated++;

                    // Emit progress every 100 files
                    if (filesValidated % 100 === 0 || filesValidated === totalFiles) {
                        this.emitEvent(socketId, 'validate:progress', {
                            operationId,
                            status: 'validating',
                            filesValidated,
                            totalFiles,
                            percentage: Math.round((filesValidated / totalFiles) * 100),
                            mismatches: mismatches.length,
                            timestamp: Date.now()
                        });
                    }
                } catch (err) {
                    console.warn(`Error validating ${file.sourcePath}:`, err.message);
                    mismatches.push({
                        file: file.relativePath,
                        issue: 'error',
                        message: `Validation error: ${err.message}`
                    });
                }
            }

            const duration = Date.now() - startTime;
            const isValid = mismatches.length === 0;

            console.log(`Validation complete: ${isValid ? 'PASS' : 'FAIL'} - ${mismatches.length} issues found`);

            // Emit completion
            this.emitEvent(socketId, 'validate:complete', {
                operationId,
                status: 'completed',
                isValid,
                filesValidated: totalFiles,
                mismatches,
                duration,
                durationFormatted: this.formatDuration(duration),
                timestamp: Date.now()
            });

            return {
                success: true,
                isValid,
                filesValidated: totalFiles,
                mismatches,
                duration
            };
        } catch (error) {
            console.error('Validation error:', error);

            this.emitEvent(socketId, 'validate:error', {
                operationId,
                status: 'error',
                error: error.message,
                timestamp: Date.now()
            });

            throw error;
        }
    }
}

module.exports = ImportService;
