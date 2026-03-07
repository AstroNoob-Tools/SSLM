import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';

import logger from '../../src/utils/logger.js';

const LOGS_DIR = '/fake/logs';
const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
    // Set a known logDir directly on the singleton — avoids calling init()
    // which would try to create a real directory.
    logger.logDir = LOGS_DIR;
});

afterEach(() => {
    vi.restoreAllMocks();
    logger.logDir = null;
});

// ─── Logger._cleanupOldLogs ───────────────────────────────────────────────────

describe('Logger._cleanupOldLogs', () => {
    it('deletes log files older than 7 days', () => {
        const oldMtime = Date.now() - 8 * DAY_MS;
        vi.spyOn(fs, 'readdirSync').mockReturnValue(['sslm-2025-01-01.log', 'sslm-2025-01-02.log']);
        vi.spyOn(fs, 'statSync').mockReturnValue({ mtimeMs: oldMtime });
        const removeSpy = vi.spyOn(fs, 'removeSync').mockReturnValue(undefined);

        logger._cleanupOldLogs();

        expect(removeSpy).toHaveBeenCalledTimes(2);
        expect(removeSpy).toHaveBeenCalledWith(path.join(LOGS_DIR, 'sslm-2025-01-01.log'));
        expect(removeSpy).toHaveBeenCalledWith(path.join(LOGS_DIR, 'sslm-2025-01-02.log'));
    });

    it('keeps log files newer than 7 days', () => {
        const recentMtime = Date.now() - 1 * DAY_MS;
        vi.spyOn(fs, 'readdirSync').mockReturnValue(['sslm-2026-03-06.log']);
        vi.spyOn(fs, 'statSync').mockReturnValue({ mtimeMs: recentMtime });
        const removeSpy = vi.spyOn(fs, 'removeSync').mockReturnValue(undefined);

        logger._cleanupOldLogs();

        expect(removeSpy).not.toHaveBeenCalled();
    });

    it('ignores files that do not match the sslm-*.log pattern', () => {
        const oldMtime = Date.now() - 8 * DAY_MS;
        vi.spyOn(fs, 'readdirSync').mockReturnValue(['app.log', 'debug.txt', 'other-2025-01-01.log']);
        vi.spyOn(fs, 'statSync').mockReturnValue({ mtimeMs: oldMtime });
        const removeSpy = vi.spyOn(fs, 'removeSync').mockReturnValue(undefined);

        logger._cleanupOldLogs();

        expect(removeSpy).not.toHaveBeenCalled();
    });

    it('does nothing when logDir is null', () => {
        logger.logDir = null;
        const readdirSpy = vi.spyOn(fs, 'readdirSync');

        logger._cleanupOldLogs();

        expect(readdirSpy).not.toHaveBeenCalled();
    });

    it('only removes matching old files when directory contains a mix', () => {
        const oldMtime = Date.now() - 8 * DAY_MS;
        const recentMtime = Date.now() - 1 * DAY_MS;
        vi.spyOn(fs, 'readdirSync').mockReturnValue([
            'sslm-2025-01-01.log',   // old, matches — should delete
            'sslm-2026-03-06.log',   // recent, matches — should keep
            'app.log',               // non-matching — should ignore
        ]);
        vi.spyOn(fs, 'statSync').mockImplementation((filePath) => ({
            mtimeMs: filePath.includes('2025-01-01') ? oldMtime : recentMtime,
        }));
        const removeSpy = vi.spyOn(fs, 'removeSync').mockReturnValue(undefined);

        logger._cleanupOldLogs();

        expect(removeSpy).toHaveBeenCalledTimes(1);
        expect(removeSpy).toHaveBeenCalledWith(path.join(LOGS_DIR, 'sslm-2025-01-01.log'));
    });
});
