'use strict';

const fs = require('fs-extra');
const path = require('path');
const DiskSpaceValidator = require('../utils/diskSpaceValidator');

/**
 * StackExportService
 *
 * Copies all .fit Light frames for a single object into a folder structure
 * ready for Siril or PixInsight:
 *
 *   [destination]/[Object_Name]/Lights/Session_YYYYMMDD/[exp]s_[filter]/Light_*.fit
 *
 * Handles objects with both _sub (EQ) and -sub (Alt/Az) folders by merging
 * them (same dedup rule as MergeService — keep newer file on conflict).
 */
class StackExportService {

    constructor(io, config) {
        this.io = io;
        this.config = config;

        this.currentOperation = null;
        this.cancelled = false;
        this.lastProgressEmit = 0;
        this.progressEmitInterval = 500;   // ms between throttled progress emits
        this.progressSamples = [];
        this.sampleWindow = 5000;   // 5-second window for speed calculation
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Plan building
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Format an exposure value (seconds) to a safe folder name segment.
     * 30.0 → "30s",  10.0 → "10s",  2.5 → "2.5s"
     */
    _formatExposure(exp) {
        return (exp % 1 === 0 ? Math.round(exp) : exp) + 's';
    }

    /** Replace spaces with underscores for a path-safe object name. */
    _sanitizeObjectName(name) {
        return name.replace(/\s+/g, '_');
    }

    /**
     * Scan one or more sub-frame folders for .fit Light frames and build an
     * export plan.  When the same filename appears in multiple sub-folders
     * (EQ + Alt/Az), the newer file (by mtime) wins.
     *
     * @param {string[]} subFolderPaths  e.g. ["H:\\Lib\\NGC 6729_sub", "H:\\Lib\\NGC 6729-sub"]
     * @param {string}   objectName      e.g. "NGC 6729"
     * @param {string}   destinationBase e.g. "E:\\Stacking"
     * @returns {Promise<Object>}        plan object
     */
    async buildExportPlan(subFolderPaths, objectName, destinationBase) {
        const objectNameClean = this._sanitizeObjectName(objectName);

        // fileMap: filename → { sourcePath, size, mtime }
        // Keeps only the newest copy when both sub-folders contain the same file.
        const fileMap = new Map();

        for (const subPath of subFolderPaths) {
            if (!(await fs.pathExists(subPath))) continue;

            const entries = await fs.readdir(subPath).catch(() => []);
            for (const entry of entries) {
                if (!entry.toLowerCase().endsWith('.fit')) continue;

                const fullPath = path.join(subPath, entry);
                try {
                    const stats = await fs.stat(fullPath);
                    const existing = fileMap.get(entry);
                    if (!existing || stats.mtime > existing.mtime) {
                        fileMap.set(entry, { sourcePath: fullPath, size: stats.size, mtime: stats.mtime });
                    }
                } catch (err) {
                    console.warn(`Cannot stat ${fullPath}:`, err.message);
                }
            }
        }

        // Light_<ObjectName>_<exp>s_<FILTER>_<YYYYMMDD>-<HHMMSS>.fit
        const lightRe = /Light_.*?([\d.]+)s_([A-Z0-9]+)_(\d{8})-\d{6}\.fit$/i;

        const filesToCopy = [];
        let totalBytes = 0;

        for (const [filename, info] of fileMap) {
            const m = filename.match(lightRe);
            if (!m) {
                console.warn(`Stack export: skipping unrecognised filename: ${filename}`);
                continue;
            }

            const exposure = parseFloat(m[1]);
            const filter = m[2].toUpperCase();
            const dateStr = m[3]; // YYYYMMDD
            const expFolder = `${this._formatExposure(exposure)}_${filter}`;
            const sessionFolder = `Session_${dateStr}`;

            const destPath = path.join(
                destinationBase,
                objectNameClean,
                'Lights',
                sessionFolder,
                expFolder,
                filename
            );

            filesToCopy.push({
                sourcePath: info.sourcePath,
                destPath,
                filename,
                size: info.size,
                session: dateStr,
                exposure,
                filter
            });

            totalBytes += info.size;
        }

        // Deterministic order: session date → filename
        filesToCopy.sort((a, b) =>
            a.session !== b.session
                ? a.session.localeCompare(b.session)
                : a.filename.localeCompare(b.filename)
        );

        return {
            objectName,
            objectNameClean,
            destinationRoot: path.join(destinationBase, objectNameClean),
            filesToCopy,
            totalFiles: filesToCopy.length,
            totalBytes
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Export execution
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Scan sub-folders and return totals for a pre-export space/confirmation check.
     * Does NOT copy anything.
     *
     * @param {string[]} subFolderPaths
     * @param {string}   objectName
     * @param {string}   destinationPath  used for available-space check
     * @returns {Promise<Object>} { totalFiles, totalBytes, available, hasEnoughSpace, ... }
     */
    async scanForExport(subFolderPaths, objectName, destinationPath) {
        const plan = await this.buildExportPlan(subFolderPaths, objectName, destinationPath);

        const required = Math.ceil(plan.totalBytes * 1.1); // 10 % buffer
        const available = await DiskSpaceValidator.getAvailableSpace(destinationPath);
        const hasEnoughSpace = available >= required;

        return {
            totalFiles: plan.totalFiles,
            totalBytes: plan.totalBytes,
            totalBytesFormatted: DiskSpaceValidator.formatBytes(plan.totalBytes),
            required,
            requiredFormatted: DiskSpaceValidator.formatBytes(required),
            available,
            availableFormatted: DiskSpaceValidator.formatBytes(available),
            hasEnoughSpace,
            destinationRoot: plan.destinationRoot
        };
    }

    /**
     * Execute the stack export.
     *
     * @param {string}   objectName
     * @param {string[]} subFolderPaths
     * @param {string}   destinationPath  base folder (object sub-folder created inside)
     * @param {string}   clientId
     * @param {string}   operationId
     */
    async exportToStacking(objectName, subFolderPaths, destinationPath, clientId, operationId) {
        this.cancelled = false;
        this.progressSamples = [];
        this.lastProgressEmit = 0;
        this.currentOperation = { objectName, subFolderPaths, destinationPath, clientId, operationId };

        const startTime = Date.now();

        try {
            // ── Scan phase ────────────────────────────────────────────────
            this._emit(clientId, 'stackexport:progress', {
                operationId, status: 'scanning',
                currentFile: 'Scanning source files…',
                filesCopied: 0, totalFiles: 0,
                filesPercentage: 0, bytesCopied: 0, totalBytes: 0, bytesPercentage: 0,
                speed: 0, speedFormatted: '-', timeRemaining: null, timeRemainingFormatted: '…',
                timestamp: Date.now()
            });

            const plan = await this.buildExportPlan(subFolderPaths, objectName, destinationPath);

            console.log('\n===== STACK EXPORT =====');
            console.log(`Object : ${objectName}  →  ${plan.objectNameClean}`);
            console.log(`Files  : ${plan.totalFiles}  (${DiskSpaceValidator.formatBytes(plan.totalBytes)})`);
            console.log(`Dest   : ${plan.destinationRoot}`);

            // Announce totals so the UI can show the correct denominator immediately
            this._emit(clientId, 'stackexport:progress', {
                operationId, status: 'starting',
                currentFile: `Preparing export (${plan.totalFiles} files)…`,
                filesCopied: 0, totalFiles: plan.totalFiles,
                filesPercentage: 0, bytesCopied: 0, totalBytes: plan.totalBytes, bytesPercentage: 0,
                speed: 0, speedFormatted: '-', timeRemaining: null, timeRemainingFormatted: '…',
                timestamp: Date.now()
            });

            // ── Copy phase ────────────────────────────────────────────────
            let filesCopied = 0;
            let bytesCopied = 0;
            const errors = [];
            const manifest = [];

            for (const file of plan.filesToCopy) {
                // Check cancellation
                if (this.cancelled) {
                    this._emit(clientId, 'stackexport:cancelled', {
                        operationId, filesCopied,
                        totalFiles: plan.totalFiles, bytesCopied,
                        totalBytes: plan.totalBytes, timestamp: Date.now()
                    });
                    this.currentOperation = null;
                    return { success: false, cancelled: true };
                }

                try {
                    await fs.ensureDir(path.dirname(file.destPath));

                    await this._copyFile(file.sourcePath, file.destPath, (currentBytes) => {
                        this._emitProgress(clientId, {
                            operationId, status: 'copying',
                            currentFile: file.filename,
                            filesCopied, totalFiles: plan.totalFiles,
                            filesPercentage: Math.round((filesCopied / plan.totalFiles) * 100),
                            bytesCopied: bytesCopied + currentBytes,
                            totalBytes: plan.totalBytes,
                            bytesPercentage: plan.totalBytes > 0
                                ? Math.round(((bytesCopied + currentBytes) / plan.totalBytes) * 100) : 0,
                            timestamp: Date.now()
                        });
                    });

                    bytesCopied += file.size;
                    filesCopied++;
                    manifest.push({ sourcePath: file.sourcePath, destPath: file.destPath, size: file.size });

                    // Per-file event (unconditional, ensures final state is emitted)
                    this._emitProgress(clientId, {
                        operationId, status: 'copying',
                        currentFile: file.filename,
                        filesCopied, totalFiles: plan.totalFiles,
                        filesPercentage: Math.round((filesCopied / plan.totalFiles) * 100),
                        bytesCopied, totalBytes: plan.totalBytes,
                        bytesPercentage: plan.totalBytes > 0
                            ? Math.round((bytesCopied / plan.totalBytes) * 100) : 0,
                        timestamp: Date.now()
                    });

                } catch (err) {
                    console.error(`Error copying ${file.sourcePath}:`, err.message);
                    errors.push({ file: file.filename, error: err.message });
                }
            }

            // ── Complete ──────────────────────────────────────────────────
            const duration = Date.now() - startTime;

            this._emit(clientId, 'stackexport:complete', {
                operationId, status: 'completed',
                filesCopied, totalFiles: plan.totalFiles,
                bytesCopied, totalBytes: plan.totalBytes,
                totalBytesFormatted: DiskSpaceValidator.formatBytes(bytesCopied),
                duration, durationFormatted: this._fmtDuration(duration),
                errors, manifest,
                destinationRoot: plan.destinationRoot,
                timestamp: Date.now()
            });

            this.currentOperation = null;
            return { success: true, filesCopied, errors, manifest };

        } catch (error) {
            console.error('Stack export error:', error);
            this._emit(clientId, 'stackexport:error', {
                operationId, status: 'error', error: error.message, timestamp: Date.now()
            });
            this.currentOperation = null;
            throw error;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Cancel
    // ─────────────────────────────────────────────────────────────────────────

    async cancelExport() {
        if (this.currentOperation) {
            this.cancelled = true;
            return { success: true };
        }
        return { success: false, error: 'No active export operation' };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Post-copy validation
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Verify every source .fit file in the manifest exists in the destination
     * with the correct file size.  Reuses the validate:progress / validate:complete
     * Socket.IO events so the existing validation UI works unchanged.
     *
     * @param {Array<{sourcePath, destPath, size}>} manifest
     * @param {string} clientId
     * @param {string} operationId
     */
    async validateExport(manifest, clientId, operationId) {
        const startTime = Date.now();
        const totalFiles = manifest.length;
        let filesValidated = 0;
        const mismatches = [];

        try {
            this._emit(clientId, 'validate:progress', {
                operationId, status: 'scanning',
                message: 'Validating exported files…', timestamp: Date.now()
            });

            for (const entry of manifest) {
                try {
                    const srcStats = await fs.stat(entry.sourcePath);
                    const destExists = await fs.pathExists(entry.destPath);

                    if (!destExists) {
                        mismatches.push({
                            file: path.basename(entry.destPath),
                            issue: 'missing',
                            message: 'File does not exist in destination'
                        });
                    } else {
                        const dstStats = await fs.stat(entry.destPath);
                        if (srcStats.size !== dstStats.size) {
                            mismatches.push({
                                file: path.basename(entry.destPath),
                                issue: 'size_mismatch',
                                message: `Size mismatch: source ${srcStats.size} B, destination ${dstStats.size} B`
                            });
                        }
                    }
                } catch (err) {
                    mismatches.push({
                        file: path.basename(entry.destPath || ''),
                        issue: 'error',
                        message: `Validation error: ${err.message}`
                    });
                }

                filesValidated++;

                if (filesValidated % 100 === 0 || filesValidated === totalFiles) {
                    this._emit(clientId, 'validate:progress', {
                        operationId, status: 'validating',
                        filesValidated, totalFiles,
                        percentage: Math.round((filesValidated / totalFiles) * 100),
                        mismatches: mismatches.length,
                        timestamp: Date.now()
                    });
                }
            }

            const duration = Date.now() - startTime;
            const success = mismatches.length === 0;

            this._emit(clientId, 'validate:complete', {
                operationId, success,
                filesValidated, totalFiles, mismatches,
                duration, durationFormatted: this._fmtDuration(duration),
                timestamp: Date.now()
            });

            return { success, mismatches };

        } catch (error) {
            this._emit(clientId, 'validate:error', {
                operationId, error: error.message, timestamp: Date.now()
            });
            throw error;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal utilities  (same pattern as ImportService / MergeService)
    // ─────────────────────────────────────────────────────────────────────────

    /** Stream-copy a single file, calling onProgress(bytesCopied) on each chunk. */
    async _copyFile(sourcePath, destPath, onProgress) {
        return new Promise((resolve, reject) => {
            const rs = fs.createReadStream(sourcePath);
            const ws = fs.createWriteStream(destPath);
            let copied = 0;

            rs.on('data', chunk => {
                copied += chunk.length;
                if (onProgress) onProgress(copied);
            });
            rs.on('error', err => { ws.destroy(); reject(err); });
            ws.on('error', err => { rs.destroy(); reject(err); });
            ws.on('finish', resolve);
            rs.pipe(ws);
        });
    }

    /** Throttled progress emit enriched with speed and ETA. */
    _emitProgress(clientId, data) {
        const now = Date.now();
        this._addSample(data.bytesCopied);

        const speed = this._calcSpeed();
        const eta = this._calcETA(data.bytesCopied, data.totalBytes);

        const enriched = {
            ...data,
            speed,
            speedFormatted: DiskSpaceValidator.formatBytes(speed) + '/s',
            timeRemaining: eta,
            timeRemainingFormatted: this._fmtDuration(eta != null ? eta * 1000 : 0)
        };

        if (now - this.lastProgressEmit >= this.progressEmitInterval) {
            this._emit(clientId, 'stackexport:progress', enriched);
            this.lastProgressEmit = now;
        }
    }

    _emit(clientId, event, data) {
        if (this.io && clientId) this.io.to(clientId).emit(event, data);
    }

    _addSample(bytesCopied) {
        const now = Date.now();
        this.progressSamples.push({ timestamp: now, bytes: bytesCopied });
        this.progressSamples = this.progressSamples.filter(s => now - s.timestamp <= this.sampleWindow);
    }

    _calcSpeed() {
        if (this.progressSamples.length < 2) return 0;
        const a = this.progressSamples[0];
        const b = this.progressSamples[this.progressSamples.length - 1];
        const dt = (b.timestamp - a.timestamp) / 1000;
        return dt > 0 ? Math.round((b.bytes - a.bytes) / dt) : 0;
    }

    _calcETA(bytesCopied, totalBytes) {
        const speed = this._calcSpeed();
        if (!speed || !totalBytes) return null;
        return Math.round((totalBytes - bytesCopied) / speed);
    }

    _fmtDuration(ms) {
        if (!ms || ms < 0) return '0s';
        const s = Math.floor(ms / 1000);
        const m = Math.floor(s / 60);
        const h = Math.floor(m / 60);
        if (h > 0) return `${h}h ${m % 60}m`;
        if (m > 0) return `${m}m ${s % 60}s`;
        return `${s}s`;
    }
}

module.exports = StackExportService;
