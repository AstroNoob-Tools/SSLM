/**
 * File Cleanup Service
 * SSLM - SeaStar Library Manager
 * Handles cleanup operations for SeaStar directories
 */

const fs = require('fs-extra');
const path = require('path');

class FileCleanup {
    /**
     * Delete empty directories
     * @param {Array<Object>} directories - Array of directory objects with path property
     * @returns {Promise<Object>} Results of deletion operation
     */
    static async deleteEmptyDirectories(directories) {
        const results = {
            success: true,
            deleted: [],
            failed: [],
            totalAttempted: directories.length,
            totalDeleted: 0,
            totalFailed: 0
        };

        for (const dir of directories) {
            try {
                // Double-check directory is empty before deleting
                const contents = await fs.readdir(dir.path);

                if (contents.length === 0) {
                    await fs.remove(dir.path);
                    results.deleted.push({
                        name: dir.name,
                        path: dir.path
                    });
                    results.totalDeleted++;
                } else {
                    results.failed.push({
                        name: dir.name,
                        path: dir.path,
                        reason: 'Directory not empty'
                    });
                    results.totalFailed++;
                }
            } catch (error) {
                results.failed.push({
                    name: dir.name,
                    path: dir.path,
                    reason: error.message
                });
                results.totalFailed++;
            }
        }

        if (results.totalFailed > 0) {
            results.success = false;
        }

        return results;
    }

    /**
     * Clean up sub-frame directories by deleting non-.fit files
     * @param {Array<Object>} objects - Array of object data from FileAnalyzer
     * @returns {Promise<Object>} Results of cleanup operation
     */
    static async cleanupSubFrameDirectories(objects) {
        const results = {
            success: true,
            cleaned: [],
            failed: [],
            totalObjects: 0,
            totalFilesDeleted: 0,
            totalSpaceFreed: 0,
            errors: []
        };

        for (const obj of objects) {
            // Skip objects without sub-frames
            if (!obj.subFolder) continue;

            results.totalObjects++;

            const objectResult = {
                name: obj.displayName,
                path: obj.subFolder.path,
                filesDeleted: 0,
                spaceFreed: 0,
                deletedFiles: []
            };

            try {
                const files = await fs.readdir(obj.subFolder.path);

                for (const file of files) {
                    const filePath = path.join(obj.subFolder.path, file);

                    try {
                        // Only delete files that are NOT .fit files
                        if (!file.endsWith('.fit')) {
                            const stats = await fs.stat(filePath);
                            const fileSize = stats.size;

                            await fs.remove(filePath);

                            objectResult.filesDeleted++;
                            objectResult.spaceFreed += fileSize;
                            objectResult.deletedFiles.push({
                                name: file,
                                size: fileSize
                            });
                        }
                    } catch (error) {
                        results.errors.push({
                            object: obj.displayName,
                            file: file,
                            error: error.message
                        });
                    }
                }

                if (objectResult.filesDeleted > 0) {
                    results.cleaned.push(objectResult);
                    results.totalFilesDeleted += objectResult.filesDeleted;
                    results.totalSpaceFreed += objectResult.spaceFreed;
                }

            } catch (error) {
                results.failed.push({
                    name: obj.displayName,
                    path: obj.subFolder.path,
                    reason: error.message
                });
            }
        }

        if (results.failed.length > 0 || results.errors.length > 0) {
            results.success = false;
        }

        return results;
    }

    /**
     * Get detailed cleanup information for sub-frame directories
     * @param {Array<Object>} objects - Array of object data from FileAnalyzer
     * @returns {Object} Detailed cleanup information
     */
    static getSubFrameCleanupInfo(objects) {
        const info = {
            objectsWithSubFrames: 0,
            totalNonFitFiles: 0,
            estimatedSpaceToFree: 0,
            details: []
        };

        for (const obj of objects) {
            if (!obj.subFolder) continue;

            info.objectsWithSubFrames++;

            const nonFitFiles = obj.subFolder.files.filter(f => !f.endsWith('.fit'));

            if (nonFitFiles.length > 0) {
                const detail = {
                    name: obj.displayName,
                    path: obj.subFolder.path,
                    nonFitFileCount: nonFitFiles.length,
                    files: nonFitFiles
                };

                info.details.push(detail);
                info.totalNonFitFiles += nonFitFiles.length;
            }
        }

        return info;
    }

    /**
     * Format bytes to human-readable string
     * @param {number} bytes - Bytes to format
     * @param {number} decimals - Decimal places
     * @returns {string}
     */
    static formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
}

module.exports = FileCleanup;
