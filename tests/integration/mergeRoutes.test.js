/**
 * Integration tests for /api/merge/* routes.
 * 
 * Strategy: vi.spyOn() intercepts service prototype methods.
 * We use require() instead of import to guarantee we get the exact same
 * CommonJS prototypes that server.js gets.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import fs from 'fs-extra';

// Use require() to match server.js CJS module cache precisely
const ImportService = require('../../src/services/importService.js');
const MergeService = require('../../src/services/mergeService.js');
const StackExportService = require('../../src/services/stackExportService.js');
const FileAnalyzer = require('../../src/services/fileAnalyzer.js');
const FileCleanup = require('../../src/services/fileCleanup.js');
const DiskSpaceValidator = require('../../src/utils/diskSpaceValidator.js');
const DirectoryBrowser = require('../../src/utils/directoryBrowser.js');
const FileRenamer = require('../../src/utils/fileRenamer.js');


// ─── Setup Mocks ──────────────────────────────────────────────────────────────

let app;
let serverInstance;
let ioInstance;
beforeAll(async () => {
    // We must mock fs-extra methods that server.js uses synchronously during startup
    vi.spyOn(fs, 'readJSONSync').mockReturnValue({
        server: { port: 3099, host: 'localhost' },
        mode: { online: false },
        seestar: { directoryName: 'MyWorks' },
        paths: { lastSourcePath: '', lastDestinationPath: '' },
        preferences: { defaultImportStrategy: 'incremental' },
    });
    vi.spyOn(fs, 'writeJSON').mockResolvedValue(undefined);
    vi.spyOn(fs, 'writeJSONSync').mockReturnValue(undefined);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('');
    vi.spyOn(fs, 'pathExists').mockResolvedValue(true);
    vi.spyOn(fs, 'ensureDirSync').mockReturnValue(undefined);
    vi.spyOn(fs, 'ensureDir').mockResolvedValue(undefined);
    vi.spyOn(fs, 'removeSync').mockReturnValue(undefined);

    // Spy on prototype methods so the real instances in server.js are stubbed
    vi.spyOn(ImportService.prototype, 'startImport').mockResolvedValue({ success: true });
    vi.spyOn(ImportService.prototype, 'cancelImport').mockResolvedValue({ success: true });
    vi.spyOn(ImportService.prototype, 'detectSeeStarDevices').mockResolvedValue([]);
    vi.spyOn(ImportService.prototype, 'validateTransfer').mockResolvedValue({ success: true });

    vi.spyOn(MergeService.prototype, 'analyzeSources').mockResolvedValue({ success: true, filesToCopy: [] });
    vi.spyOn(MergeService.prototype, 'executeMerge').mockResolvedValue({ success: true });
    vi.spyOn(MergeService.prototype, 'cancelMerge').mockResolvedValue({ success: true, message: 'Merge cancelled' });
    vi.spyOn(MergeService.prototype, 'validateMerge').mockResolvedValue({ success: true });

    vi.spyOn(StackExportService.prototype, 'exportToStacking').mockResolvedValue({ success: true });
    vi.spyOn(StackExportService.prototype, 'cancelExport').mockResolvedValue({ success: true });

    vi.spyOn(FileAnalyzer, 'analyzeDirectory').mockResolvedValue({ success: true, summary: {}, objects: [] });
    vi.spyOn(FileAnalyzer, 'getSuggestedCleanup').mockReturnValue([]);

    vi.spyOn(FileCleanup, 'deleteEmptyDirectories').mockResolvedValue({ totalDeleted: 0, totalFailed: 0 });
    vi.spyOn(FileCleanup, 'cleanupSubFrameDirectories').mockResolvedValue({ totalFilesDeleted: 0, totalSpaceFreed: 0 });
    vi.spyOn(FileCleanup, 'deleteSessionFiles').mockResolvedValue({ success: true });
    vi.spyOn(FileCleanup, 'getSubFrameCleanupInfo').mockReturnValue({});
    vi.spyOn(FileCleanup, 'formatBytes').mockReturnValue('0 B');

    vi.spyOn(DiskSpaceValidator, 'hasEnoughSpace').mockResolvedValue({ hasEnoughSpace: true, required: 0, available: 1e12, requiredFormatted: '0 B', availableFormatted: '1 TB' });
    vi.spyOn(DiskSpaceValidator, 'getAvailableSpace').mockResolvedValue(1e12);
    vi.spyOn(DiskSpaceValidator, 'getMergeRequiredSpace').mockResolvedValue(0);
    vi.spyOn(DiskSpaceValidator, 'formatBytes').mockImplementation((b) => `${b} B`);

    vi.spyOn(DirectoryBrowser, 'getWindowsDrives').mockResolvedValue([]);
    vi.spyOn(DirectoryBrowser, 'getCommonDirectories').mockReturnValue([]);
    vi.spyOn(DirectoryBrowser, 'getDirectoryContents').mockResolvedValue({ currentPath: 'C:\\', items: [], parentPath: null });
    vi.spyOn(DirectoryBrowser, 'hasMyWorkDirectory').mockResolvedValue(false);

    vi.spyOn(FileRenamer, 'renameObject').mockResolvedValue({ success: true });

    const serverModule = await import('../../server.js');
    app = serverModule.app;
    serverInstance = serverModule.server;
    ioInstance = serverModule.io;

    if (serverInstance) {
        serverInstance.setMaxListeners(0);
    }
});

afterAll(async () => {
    vi.restoreAllMocks();
    if (ioInstance) {
        ioInstance.close();
    }
    if (serverInstance) {
        await new Promise(resolve => serverInstance.close(resolve));
    }
});

// ─── POST /api/merge/analyze ──────────────────────────────────────────────────

describe('POST /api/merge/analyze', () => {
    beforeEach(() => {
        vi.mocked(MergeService.prototype.analyzeSources).mockClear();
    });

    it('returns 400 when fewer than 2 source paths are provided', async () => {
        const res = await request(app).post('/api/merge/analyze').send({
            sourcePaths: ['C:\\src1'],
            destinationPath: 'C:\\dst',
        });
        expect(res.status).toBe(400);
    });

    it('returns 400 when destinationPath is missing', async () => {
        const res = await request(app).post('/api/merge/analyze').send({
            sourcePaths: ['C:\\src1', 'C:\\src2'],
        });
        expect(res.status).toBe(400);
    });

    it('returns 200 with merge plan when params are valid', async () => {
        const res = await request(app).post('/api/merge/analyze').send({
            sourcePaths: ['C:\\src1', 'C:\\src2'],
            destinationPath: 'C:\\dst',
            clientId: 'sock-abc',
        });
        expect(res.status).toBe(200);
        expect(MergeService.prototype.analyzeSources).toHaveBeenCalled();
    });
});

// ─── POST /api/merge/start ────────────────────────────────────────────────────

describe('POST /api/merge/start', () => {
    beforeEach(() => {
        vi.mocked(MergeService.prototype.executeMerge).mockClear();
    });

    it('returns 400 when clientId is missing', async () => {
        const res = await request(app).post('/api/merge/start').send({
            mergePlan: { destination: 'C:\\dst', filesToCopy: [] }
        });
        expect(res.status).toBe(400);
    });

    it('returns 400 when mergePlan is missing', async () => {
        const res = await request(app).post('/api/merge/start').send({
            clientId: 'sock-abc',
        });
        expect(res.status).toBe(400);
    });

    it('returns 200 with operationId when params are valid', async () => {
        const res = await request(app).post('/api/merge/start').send({
            sourcePaths: ['C:\\src1', 'C:\\src2'],
            destinationPath: 'C:\\dst',
            mergePlan: { destination: 'C:\\dst', filesToCopy: [] },
            clientId: 'sock-abc',
        });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(typeof res.body.operationId).toBe('string');
        expect(MergeService.prototype.executeMerge).toHaveBeenCalled();
    });
});

// ─── POST /api/merge/cancel ───────────────────────────────────────────────────

describe('POST /api/merge/cancel', () => {
    beforeEach(() => {
        vi.mocked(MergeService.prototype.cancelMerge).mockClear();
    });

    it('returns 200', async () => {
        const res = await request(app).post('/api/merge/cancel');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(MergeService.prototype.cancelMerge).toHaveBeenCalled();
    });
});
