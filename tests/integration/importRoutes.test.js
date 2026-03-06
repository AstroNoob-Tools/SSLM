/**
 * Integration tests for /api/import/* routes.
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

    vi.spyOn(MergeService.prototype, 'analyzeSources').mockResolvedValue({ filesToCopy: [] });
    vi.spyOn(MergeService.prototype, 'executeMerge').mockResolvedValue({ success: true });
    vi.spyOn(MergeService.prototype, 'cancelMerge').mockResolvedValue({ success: true });
    vi.spyOn(MergeService.prototype, 'validateMerge').mockResolvedValue({ success: true });

    vi.spyOn(StackExportService.prototype, 'exportToStacking').mockResolvedValue({ success: true });
    vi.spyOn(StackExportService.prototype, 'cancelExport').mockResolvedValue({ success: true });

    vi.spyOn(FileAnalyzer, 'analyzeDirectory').mockResolvedValue({ success: true, summary: {}, objects: [] });
    vi.spyOn(FileCleanup, 'deleteEmptyDirectories').mockResolvedValue({ totalDeleted: 0, totalFailed: 0 });
    vi.spyOn(FileCleanup, 'cleanupSubFrameDirectories').mockResolvedValue({ totalFilesDeleted: 0, totalSpaceFreed: 0 });

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

// ─── POST /api/import/start ───────────────────────────────────────────────────

describe('POST /api/import/start', () => {
    beforeEach(() => {
        vi.mocked(ImportService.prototype.startImport).mockClear();
    });

    it('returns 400 when clientId is missing', async () => {
        const res = await request(app).post('/api/import/start').send({
            sourcePath: 'C:\\src',
            destinationPath: 'C:\\dst',
            strategy: 'incremental',
            // clientId intentionally omitted
        });
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('returns 400 when strategy is missing', async () => {
        const res = await request(app).post('/api/import/start').send({
            sourcePath: 'C:\\src',
            destinationPath: 'C:\\dst',
            clientId: 'sock-abc',
            // strategy intentionally omitted
        });
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('returns 200 with operationId when params are valid', async () => {
        const res = await request(app).post('/api/import/start').send({
            sourcePath: 'C:\\src',
            destinationPath: 'C:\\dst',
            strategy: 'incremental',
            clientId: 'sock-abc',
        });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(typeof res.body.operationId).toBe('string');
        // Verify the prototype method was called
        expect(ImportService.prototype.startImport).toHaveBeenCalled();
    });
});

// ─── POST /api/import/cancel ──────────────────────────────────────────────────

describe('POST /api/import/cancel', () => {
    beforeEach(() => {
        vi.mocked(ImportService.prototype.cancelImport).mockClear();
    });

    it('returns 200 even when no operation is active', async () => {
        const res = await request(app).post('/api/import/cancel');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(ImportService.prototype.cancelImport).toHaveBeenCalled();
    });
});

// ─── POST /api/import/validate ────────────────────────────────────────────────

describe('POST /api/import/validate', () => {
    beforeEach(() => {
        vi.mocked(ImportService.prototype.validateTransfer).mockClear();
    });

    it('returns 400 when clientId is missing', async () => {
        const res = await request(app).post('/api/import/validate').send({
            sourcePath: 'C:\\src',
            destinationPath: 'C:\\dst',
        });
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('returns 200 when all params are valid', async () => {
        const res = await request(app).post('/api/import/validate').send({
            sourcePath: 'C:\\src',
            destinationPath: 'C:\\dst',
            clientId: 'sock-abc',
        });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(ImportService.prototype.validateTransfer).toHaveBeenCalled();
    });
});
