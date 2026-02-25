/**
 * File Analyzer Service
 * SSLM - SeeStar Library Manager
 * Analyzes SeeStar directory structure and generates statistics
 */

const fs = require('fs-extra');
const path = require('path');
const CatalogParser = require('./catalogParser');

class FileAnalyzer {
    /**
     * Analyze a SeeStar directory
     * @param {string} directoryPath - Path to analyze
     * @returns {Promise<Object>} Analysis results
     */
    static async analyzeDirectory(directoryPath) {
        try {
            const startTime = Date.now();

            // Verify directory exists
            const exists = await fs.pathExists(directoryPath);
            if (!exists) {
                return {
                    success: false,
                    error: 'Directory does not exist'
                };
            }

            // Read directory contents
            const items = await fs.readdir(directoryPath);

            const objects = new Map(); // Key: baseName, Value: object data
            const emptyDirectories = [];
            const subFrameFolders = new Set();

            let totalFiles = 0;
            let totalSize = 0;
            let fitCount = 0;
            let jpgCount = 0;
            let thnCount = 0;
            let mp4Count = 0;

            // Date range tracking
            let oldestDate = null;
            let newestDate = null;

            // First pass: Collect all directories
            for (const item of items) {
                const itemPath = path.join(directoryPath, item);

                try {
                    const stats = await fs.stat(itemPath);

                    // Only process directories
                    if (!stats.isDirectory()) continue;

                    // Check if directory is empty
                    const dirContents = await fs.readdir(itemPath);
                    const isEmpty = dirContents.length === 0;

                    if (isEmpty) {
                        emptyDirectories.push({
                            name: item,
                            path: itemPath
                        });
                        continue; // Skip empty directories
                    }

                    // Parse the folder name
                    const parsed = CatalogParser.parseObjectName(item);

                    if (parsed.isSubFolder) {
                        // Track sub-frame folders
                        subFrameFolders.add(parsed.baseName);
                    } else {
                        // Initialize or get object data
                        if (!objects.has(parsed.baseName)) {
                            objects.set(parsed.baseName, {
                                name: parsed.baseName,
                                displayName: parsed.displayName,
                                catalog: parsed.catalog,
                                catalogNumber: parsed.catalogNumber,
                                variant: parsed.variant,
                                hasSubFrames: false,
                                mountMode: null,       // 'eq' | 'altaz' | 'both'
                                isMosaic: CatalogParser.isMosaic(item),
                                mainFolder: {
                                    path: itemPath,
                                    files: [],
                                    fileCount: 0,
                                    size: 0
                                },
                                subFolderEq: null,     // _sub  (Eq mount mode)
                                subFolderAltAz: null,  // -sub  (Alt/Az mount mode)
                                subFolder: null,       // backward-compat alias
                                dates: [],
                                stackingCounts: [],
                                exposures: [],
                                filters: [],
                                totalIntegrationTime: 0,  // in seconds
                                lightFrameCount: 0
                            });
                        }

                        // Scan main folder files
                        const objectData = objects.get(parsed.baseName);
                        await this.scanFolderFiles(itemPath, objectData.mainFolder, objectData);
                    }
                } catch (error) {
                    console.warn(`Error processing ${item}:`, error.message);
                }
            }

            // Second pass: Link sub-frame folders to main folders
            for (const item of items) {
                const itemPath = path.join(directoryPath, item);

                try {
                    const stats = await fs.stat(itemPath);
                    if (!stats.isDirectory()) continue;

                    // Check if empty
                    const dirContents = await fs.readdir(itemPath);
                    if (dirContents.length === 0) continue;

                    const parsed = CatalogParser.parseObjectName(item);

                    if (parsed.isSubFolder && objects.has(parsed.baseName)) {
                        const objectData = objects.get(parsed.baseName);
                        objectData.hasSubFrames = true;

                        const subData = {
                            path: itemPath,
                            files: [],
                            fileCount: 0,
                            size: 0
                        };

                        if (parsed.mountMode === 'eq') {
                            objectData.subFolderEq = subData;
                        } else {
                            objectData.subFolderAltAz = subData;
                        }

                        // Keep mountMode on the object: first seen sets it, second of a
                        // different type upgrades it to 'both'.
                        if (objectData.mountMode === null) {
                            objectData.mountMode = parsed.mountMode;
                        } else if (objectData.mountMode !== parsed.mountMode) {
                            objectData.mountMode = 'both';
                        }

                        // Backward-compat alias: prefer Eq folder when both exist.
                        objectData.subFolder = objectData.subFolderEq || objectData.subFolderAltAz;

                        await this.scanFolderFiles(itemPath, subData, objectData);
                    }
                } catch (error) {
                    console.warn(`Error processing sub-folder ${item}:`, error.message);
                }
            }

            // Calculate totals and catalog breakdown
            const objectsArray = Array.from(objects.values());
            const catalogBreakdown = {};

            for (const obj of objectsArray) {
                // Catalog breakdown
                if (!catalogBreakdown[obj.catalog]) {
                    catalogBreakdown[obj.catalog] = 0;
                }
                catalogBreakdown[obj.catalog]++;

                // Total files and size
                totalFiles += obj.mainFolder.fileCount;
                totalSize += obj.mainFolder.size;

                // File type counts
                fitCount += obj.mainFolder.files.filter(f => f.endsWith('.fit')).length;
                jpgCount += obj.mainFolder.files.filter(f => f.endsWith('.jpg')).length;
                thnCount += obj.mainFolder.files.filter(f => f.endsWith('_thn.jpg')).length;
                mp4Count += obj.mainFolder.files.filter(f => f.endsWith('.mp4')).length;

                // Include both sub-folders (Eq and Alt/Az) in all totals
                for (const sf of [obj.subFolderEq, obj.subFolderAltAz].filter(Boolean)) {
                    totalFiles += sf.fileCount;
                    totalSize  += sf.size;
                    fitCount   += sf.files.filter(f => f.endsWith('.fit')).length;
                    jpgCount   += sf.files.filter(f => f.endsWith('.jpg')).length;
                    thnCount   += sf.files.filter(f => f.endsWith('_thn.jpg')).length;
                    mp4Count   += sf.files.filter(f => f.endsWith('.mp4')).length;
                }

                // Date range
                for (const date of obj.dates) {
                    if (!oldestDate || date < oldestDate) oldestDate = date;
                    if (!newestDate || date > newestDate) newestDate = date;
                }
            }

            // Count objects with and without sub-frames
            const withSubFrames = objectsArray.filter(obj => obj.hasSubFrames).length;
            const withoutSubFrames = objectsArray.length - withSubFrames;

            const analysisTime = Date.now() - startTime;

            return {
                success: true,
                path: directoryPath,
                summary: {
                    totalObjects: objectsArray.length,
                    withSubFrames,
                    withoutSubFrames,
                    emptyDirectories: emptyDirectories.length,
                    totalFiles,
                    totalSize,
                    totalSizeFormatted: this.formatBytes(totalSize),
                    fitFiles: fitCount,
                    jpgFiles: jpgCount,
                    thumbnails: thnCount,
                    mp4Files: mp4Count
                },
                catalogBreakdown,
                objects: objectsArray.sort((a, b) => a.displayName.localeCompare(b.displayName)),
                emptyDirectories: emptyDirectories.sort((a, b) => a.name.localeCompare(b.name)),
                dateRange: {
                    oldest: oldestDate,
                    newest: newestDate
                },
                analysisTime
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Scan files in a folder
     * @param {string} folderPath - Folder to scan
     * @param {Object} folderData - Folder data object to update
     * @param {Object} objectData - Parent object data
     */
    static async scanFolderFiles(folderPath, folderData, objectData) {
        try {
            const files = await fs.readdir(folderPath);

            for (const file of files) {
                const filePath = path.join(folderPath, file);

                try {
                    const stats = await fs.stat(filePath);

                    if (stats.isFile()) {
                        folderData.files.push(file);
                        folderData.fileCount++;
                        folderData.size += stats.size;

                        // Extract metadata from filename
                        const date = CatalogParser.extractDateFromFilename(file);
                        if (date && !objectData.dates.includes(date)) {
                            objectData.dates.push(date);
                        }

                        // Only extract stacking counts from .fit files (not .jpg or thumbnails)
                        if (file.endsWith('.fit')) {
                            const stackCount = CatalogParser.extractStackingCount(file);
                            if (stackCount && !objectData.stackingCounts.includes(stackCount)) {
                                objectData.stackingCounts.push(stackCount);
                            }
                        }

                        const exposure = CatalogParser.extractExposure(file);
                        if (exposure && !objectData.exposures.includes(exposure)) {
                            objectData.exposures.push(exposure);
                        }

                        const filter = CatalogParser.extractFilter(file);
                        if (filter && !objectData.filters.includes(filter)) {
                            objectData.filters.push(filter);
                        }

                        // Calculate integration time from Light frames
                        if (file.startsWith('Light_') && file.endsWith('.fit') && exposure) {
                            objectData.totalIntegrationTime += exposure;
                            objectData.lightFrameCount++;
                        }
                    }
                } catch (error) {
                    console.warn(`Error processing file ${file}:`, error.message);
                }
            }
        } catch (error) {
            console.warn(`Error scanning folder ${folderPath}:`, error.message);
        }
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

    /**
     * Format integration time to human-readable string
     * @param {number} seconds - Time in seconds
     * @returns {string}
     */
    static formatIntegrationTime(seconds) {
        if (seconds === 0) return '0s';

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        const parts = [];
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

        return parts.join(' ');
    }

    /**
     * Get suggested cleanup actions
     * @param {Object} analysisResult - Result from analyzeDirectory
     * @returns {Array} Array of cleanup suggestions
     */
    static getSuggestedCleanup(analysisResult) {
        const suggestions = [];

        // Empty directories
        if (analysisResult.emptyDirectories && analysisResult.emptyDirectories.length > 0) {
            suggestions.push({
                type: 'empty_directories',
                priority: 'low',
                count: analysisResult.emptyDirectories.length,
                description: `${analysisResult.emptyDirectories.length} empty directories can be safely deleted`,
                directories: analysisResult.emptyDirectories
            });
        }

        // Unnecessary JPG files in _sub folders
        let unnecessaryJpgCount = 0;
        let unnecessaryJpgSize = 0;

        for (const obj of analysisResult.objects || []) {
            if (obj.subFolder) {
                const jpgFiles = obj.subFolder.files.filter(f =>
                    f.endsWith('.jpg') && !f.endsWith('_thn.jpg')
                );
                unnecessaryJpgCount += jpgFiles.length;
                // Estimate size (would need actual calculation)
            }
        }

        if (unnecessaryJpgCount > 0) {
            suggestions.push({
                type: 'unnecessary_jpgs',
                priority: 'medium',
                count: unnecessaryJpgCount,
                description: `${unnecessaryJpgCount} JPG files in sub-frame folders can be deleted to save space`,
                note: 'JPG files in _sub folders are not needed'
            });
        }

        return suggestions;
    }
}

module.exports = FileAnalyzer;
