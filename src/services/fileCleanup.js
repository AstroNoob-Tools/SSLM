/**
 * File Cleanup Service
 * SSLM - SeeStar Library Manager
 * Handles cleanup operations for SeeStar directories
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
            // Collect all sub-folders for this object (Eq and/or Alt/Az)
            const subFolders = [obj.subFolderEq, obj.subFolderAltAz].filter(Boolean);
            // Fallback for legacy data that only has subFolder set
            if (subFolders.length === 0 && obj.subFolder) subFolders.push(obj.subFolder);

            if (subFolders.length === 0) continue;

            results.totalObjects++;

            for (const sf of subFolders) {
                const objectResult = {
                    name: obj.displayName,
                    path: sf.path,
                    filesDeleted: 0,
                    spaceFreed: 0,
                    deletedFiles: []
                };

                try {
                    const files = await fs.readdir(sf.path);

                    for (const file of files) {
                        const filePath = path.join(sf.path, file);

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
                        path: sf.path,
                        reason: error.message
                    });
                }
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
            const subFolders = [obj.subFolderEq, obj.subFolderAltAz].filter(Boolean);
            if (subFolders.length === 0 && obj.subFolder) subFolders.push(obj.subFolder);

            if (subFolders.length === 0) continue;

            info.objectsWithSubFrames++;

            for (const sf of subFolders) {
                const nonFitFiles = sf.files.filter(f => !f.endsWith('.fit'));

                if (nonFitFiles.length > 0) {
                    info.details.push({
                        name: obj.displayName,
                        path: sf.path,
                        nonFitFileCount: nonFitFiles.length,
                        files: nonFitFiles
                    });
                    info.totalNonFitFiles += nonFitFiles.length;
                }
            }
        }

        return info;
    }

    /**
     * Delete all files belonging to a specific imaging session
     * @param {Object} params
     * @param {string} params.mainFolderPath - Full path to the main object folder
     * @param {string[]} params.mainFiles - Filenames (not paths) in main folder to delete
     * @param {Array<{folder:string,file:string}>} params.subFiles - Sub-frame files with their
     *   own folder paths (supports files from multiple sub-folders: _sub and/or -sub)
     * @returns {Promise<Object>} Results of deletion
     */
    static async deleteSessionFiles({ mainFolderPath, mainFiles = [], subFiles = [] }) {
        const results = {
            success: true,
            filesDeleted: 0,
            spaceFreed: 0,
            errors: []
        };

        const deleteList = [
            ...mainFiles.map(f => ({ folder: mainFolderPath, file: f })),
            ...subFiles   // already { folder, file } objects
        ];

        for (const { folder, file } of deleteList) {
            if (!folder) continue;
            const filePath = path.join(folder, file);
            try {
                const stats = await fs.stat(filePath);
                results.spaceFreed += stats.size;
                await fs.remove(filePath);
                results.filesDeleted++;
            } catch (error) {
                results.errors.push({ file, error: error.message });
            }
        }

        if (results.errors.length > 0) {
            results.success = false;
        }

        return results;
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
