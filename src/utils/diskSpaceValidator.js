const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class DiskSpaceValidator {
    /**
     * Returns true when a file lives inside a _sub directory AND is not a .fit file.
     * @param {string} relativePath - File path relative to its library root
     * @returns {boolean}
     */
    static isSubframeNonFit(relativePath) {
        const ext = path.extname(relativePath).toLowerCase();
        if (ext === '.fit') return false;

        const parts = relativePath.replace(/\\/g, '/').split('/');
        for (let i = 0; i < parts.length - 1; i++) {
            if (parts[i].toLowerCase().endsWith('_sub')) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get available space on a drive (in bytes)
     * @param {string} targetPath - Path to check (file or directory)
     * @returns {Promise<number>} Available space in bytes
     */
    static async getAvailableSpace(targetPath) {
        try {
            // Get the drive letter/root from the path
            const parsedPath = path.parse(targetPath);
            const drive = parsedPath.root || targetPath;

            // Use wmic on Windows to get free space
            const command = `wmic logicaldisk where "DeviceID='${drive.replace('\\', '')}'" get FreeSpace`;
            const { stdout } = await execAsync(command);

            // Parse the output
            const lines = stdout.trim().split('\n');
            if (lines.length >= 2) {
                const freeSpace = parseInt(lines[1].trim());
                if (!isNaN(freeSpace)) {
                    return freeSpace;
                }
            }

            throw new Error('Unable to parse free space');
        } catch (error) {
            console.error('Error getting available space:', error);
            throw new Error(`Cannot determine available disk space: ${error.message}`);
        }
    }

    /**
     * Calculate total size of a directory recursively
     * @param {string} sourcePath - Directory path to scan
     * @param {string} subframeMode - 'all' or 'fit_only'
     * @returns {Promise<number>} Total size in bytes
     */
    static async getRequiredSpace(sourcePath, subframeMode = 'all') {
        try {
            let totalSize = 0;

            const scanDirectory = async (dirPath) => {
                try {
                    const items = await fs.readdir(dirPath);

                    for (const item of items) {
                        const itemPath = path.join(dirPath, item);

                        try {
                            const stats = await fs.stat(itemPath);

                            if (stats.isDirectory()) {
                                await scanDirectory(itemPath);
                            } else {
                                // Skip non-fit files in _sub dirs when in expurged mode
                                if (subframeMode === 'fit_only') {
                                    const relativePath = path.relative(sourcePath, itemPath);
                                    if (this.isSubframeNonFit(relativePath)) continue;
                                }
                                totalSize += stats.size;
                            }
                        } catch (err) {
                            // Skip files/dirs we can't access
                            console.warn(`Cannot access ${itemPath}:`, err.message);
                        }
                    }
                } catch (err) {
                    console.warn(`Cannot read directory ${dirPath}:`, err.message);
                }
            };

            await scanDirectory(sourcePath);
            return totalSize;
        } catch (error) {
            console.error('Error calculating required space:', error);
            throw new Error(`Cannot calculate directory size: ${error.message}`);
        }
    }

    /**
     * Calculate incremental space required (only for new/modified files)
     * @param {string} sourcePath - Source directory to scan
     * @param {string} destinationPath - Destination directory
     * @param {string} subframeMode - 'all' or 'fit_only'
     * @returns {Promise<number>} Required size in bytes for incremental copy
     */
    static async getIncrementalRequiredSpace(sourcePath, destinationPath, subframeMode = 'all') {
        try {
            let requiredSize = 0;

            const scanDirectory = async (currentSourcePath, currentDestPath) => {
                try {
                    const items = await fs.readdir(currentSourcePath);

                    for (const item of items) {
                        const sourceItemPath = path.join(currentSourcePath, item);
                        const destItemPath = path.join(currentDestPath, item);

                        try {
                            const sourceStats = await fs.stat(sourceItemPath);

                            if (sourceStats.isDirectory()) {
                                // Recurse into subdirectory
                                await scanDirectory(sourceItemPath, destItemPath);
                            } else {
                                // Skip non-fit files in _sub dirs when in expurged mode
                                if (subframeMode === 'fit_only') {
                                    const relativePath = path.relative(sourcePath, sourceItemPath);
                                    if (this.isSubframeNonFit(relativePath)) continue;
                                }

                                // Check if file needs to be copied
                                const shouldCopy = await this.shouldCopyFile(
                                    sourceItemPath,
                                    destItemPath,
                                    sourceStats
                                );

                                if (shouldCopy) {
                                    requiredSize += sourceStats.size;
                                }
                            }
                        } catch (err) {
                            // Skip files/dirs we can't access
                            console.warn(`Cannot access ${sourceItemPath}:`, err.message);
                        }
                    }
                } catch (err) {
                    console.warn(`Cannot read directory ${currentSourcePath}:`, err.message);
                }
            };

            await scanDirectory(sourcePath, destinationPath);
            return requiredSize;
        } catch (error) {
            console.error('Error calculating incremental space:', error);
            throw new Error(`Cannot calculate incremental size: ${error.message}`);
        }
    }

    /**
     * Check if a file should be copied (for incremental copy)
     * @param {string} sourceFile - Source file path
     * @param {string} destFile - Destination file path
     * @param {Object} sourceStats - Source file stats (optional, will stat if not provided)
     * @returns {Promise<boolean>} True if file should be copied
     */
    static async shouldCopyFile(sourceFile, destFile, sourceStats = null) {
        try {
            // Check if destination file exists
            const destExists = await fs.pathExists(destFile);
            if (!destExists) {
                return true; // File doesn't exist, needs to be copied
            }

            // Get source stats if not provided
            if (!sourceStats) {
                sourceStats = await fs.stat(sourceFile);
            }

            // Get destination stats
            const destStats = await fs.stat(destFile);

            // Copy if size differs or source is newer
            return (
                sourceStats.size !== destStats.size ||
                sourceStats.mtime > destStats.mtime
            );
        } catch (err) {
            // If error checking, assume we should copy
            return true;
        }
    }

    /**
     * Calculate space required for merge operation (deduplicated size)
     * @param {Array<string>} sourcePaths - Array of source library paths
     * @param {string} subframeMode - 'all' or 'fit_only'
     * @returns {Promise<number>} Required size in bytes (after deduplication)
     */
    static async getMergeRequiredSpace(sourcePaths, subframeMode = 'all') {
        try {
            const fileInventory = new Map();

            // Build file inventory from all sources
            for (const sourcePath of sourcePaths) {
                await this.buildMergeInventory(sourcePath, sourcePath, fileInventory, subframeMode);
            }

            // Calculate size of unique files only
            let totalSize = 0;

            for (const [relativePath, candidates] of fileInventory) {
                // Find the largest file size among candidates
                // (in case same file has different sizes across sources)
                let maxSize = 0;
                for (const candidate of candidates) {
                    if (candidate.size > maxSize) {
                        maxSize = candidate.size;
                    }
                }
                totalSize += maxSize;
            }

            return totalSize;
        } catch (error) {
            console.error('Error calculating merge space:', error);
            throw new Error(`Cannot calculate merge size: ${error.message}`);
        }
    }

    /**
     * Helper to build merge file inventory
     * @param {string} dirPath - Directory to scan
     * @param {string} basePath - Base path for relative paths
     * @param {Map} inventory - File inventory map
     * @param {string} subframeMode - 'all' or 'fit_only'
     */
    static async buildMergeInventory(dirPath, basePath, inventory, subframeMode = 'all') {
        try {
            const items = await fs.readdir(dirPath);

            for (const item of items) {
                const itemPath = path.join(dirPath, item);

                try {
                    const stats = await fs.stat(itemPath);

                    if (stats.isDirectory()) {
                        await this.buildMergeInventory(itemPath, basePath, inventory, subframeMode);
                    } else {
                        const relativePath = path.relative(basePath, itemPath);

                        // Skip non-fit files in _sub dirs when in expurged mode
                        if (subframeMode === 'fit_only' && this.isSubframeNonFit(relativePath)) {
                            continue;
                        }

                        if (!inventory.has(relativePath)) {
                            inventory.set(relativePath, []);
                        }

                        inventory.get(relativePath).push({
                            path: itemPath,
                            size: stats.size,
                            mtime: stats.mtime
                        });
                    }
                } catch (err) {
                    console.warn(`Cannot access ${itemPath}:`, err.message);
                }
            }
        } catch (err) {
            console.warn(`Cannot read directory ${dirPath}:`, err.message);
        }
    }

    /**
     * Check if destination has enough space for source
     * @param {string} sourcePath - Source directory to copy from
     * @param {string} destinationPath - Destination directory to copy to
     * @param {string} strategy - Import strategy: 'full' or 'incremental'
     * @param {number} buffer - Safety buffer multiplier (e.g., 1.1 for 10% extra)
     * @returns {Promise<Object>} Validation result with space information
     */
    static async hasEnoughSpace(sourcePath, destinationPath, strategy = 'full', buffer = 1.1, subframeMode = 'all') {
        try {
            // Validate paths exist
            const sourceExists = await fs.pathExists(sourcePath);
            if (!sourceExists) {
                return {
                    hasEnoughSpace: false,
                    error: 'Source path does not exist',
                    required: 0,
                    available: 0,
                    requiredFormatted: '0 B',
                    availableFormatted: '0 B'
                };
            }

            // Calculate required space based on strategy and subframe mode
            let required;
            if (strategy === 'incremental') {
                required = await this.getIncrementalRequiredSpace(sourcePath, destinationPath, subframeMode);
            } else {
                required = await this.getRequiredSpace(sourcePath, subframeMode);
            }

            const requiredWithBuffer = Math.ceil(required * buffer);

            // Get available space
            const available = await this.getAvailableSpace(destinationPath);

            // Format bytes for display
            const requiredFormatted = this.formatBytes(requiredWithBuffer);
            const availableFormatted = this.formatBytes(available);

            return {
                hasEnoughSpace: available >= requiredWithBuffer,
                required: requiredWithBuffer,
                requiredFormatted,
                available,
                availableFormatted,
                bufferApplied: buffer,
                requiredWithoutBuffer: required,
                requiredWithoutBufferFormatted: this.formatBytes(required),
                strategy
            };
        } catch (error) {
            console.error('Error validating disk space:', error);
            throw error;
        }
    }

    /**
     * Format bytes to human-readable format
     * @param {number} bytes - Number of bytes
     * @param {number} decimals - Number of decimal places
     * @returns {string} Formatted string (e.g., "48.8 GB")
     */
    static formatBytes(bytes, decimals = 1) {
        if (bytes === 0) return '0 B';

        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
}

module.exports = DiskSpaceValidator;
