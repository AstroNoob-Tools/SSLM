import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import fs from 'fs-extra';
// Spy directly on the fs-extra object rather than using vi.mock,
// to avoid ESM/CJS interop mock hoisting issues where the service's
// require() sees a different reference.

vi.mock('../../src/utils/directoryBrowser.js', () => ({ default: {} }));
vi.mock('../../src/utils/diskSpaceValidator.js', () => ({
    default: { formatBytes: (b) => `${b} B`, hasEnoughSpace: vi.fn() },
}));

import ImportService from '../../src/services/importService.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeIo() {
    const emitSpy = vi.fn();
    return { to: vi.fn().mockReturnValue({ emit: emitSpy }), _emitSpy: emitSpy };
}

const mockConfig = { seestar: { directoryName: 'MyWorks' } };

/** Stat object with callable isDirectory/isFile/isSymbolicLink — the service invokes these as functions */
function makeStat({ size = 100, mtime = new Date('2025-01-01'), isDir = false } = {}) {
    return { size, mtime, isDirectory: () => isDir, isFile: () => !isDir, isSymbolicLink: () => false };
}

beforeEach(() => {
    vi.restoreAllMocks(); // Restores original implementations
    // Setup generic spies
    vi.spyOn(fs, 'readdir').mockResolvedValue([]);
    vi.spyOn(fs, 'stat').mockResolvedValue(makeStat());
    vi.spyOn(fs, 'lstat').mockResolvedValue(makeStat()); // scanDirectory now uses lstat
    vi.spyOn(fs, 'pathExists').mockResolvedValue(true);
    vi.spyOn(fs, 'ensureDir').mockResolvedValue(undefined);
    vi.spyOn(fs, 'createReadStream').mockReturnValue({});
    vi.spyOn(fs, 'createWriteStream').mockReturnValue({});
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ─── emitEvent ────────────────────────────────────────────────────────────────

describe('ImportService.emitEvent', () => {
    it('emits to the correct socket room', () => {
        const io = makeIo();
        const svc = new ImportService(io, mockConfig);
        svc.emitEvent('socket-123', 'import:test', { foo: 1 });
        expect(io.to).toHaveBeenCalledWith('socket-123');
        expect(io._emitSpy).toHaveBeenCalledWith('import:test', { foo: 1 });
    });

    it('is a no-op when clientId is null', () => {
        const io = makeIo();
        const svc = new ImportService(io, mockConfig);
        svc.emitEvent(null, 'import:test', {});
        expect(io.to).not.toHaveBeenCalled();
    });

    it('is a no-op when io is falsy', () => {
        const svc = new ImportService(null, mockConfig);
        expect(() => svc.emitEvent('socket-123', 'import:test', {})).not.toThrow();
    });
});

// ─── shouldCopyFile ───────────────────────────────────────────────────────────

describe('ImportService.shouldCopyFile', () => {
    let svc;
    beforeEach(() => { svc = new ImportService(makeIo(), mockConfig); });

    it('full strategy always returns true', async () => {
        const result = await svc.shouldCopyFile('/src/a.fit', '/dst/a.fit', 'full');
        expect(result).toBe(true);
    });

    it('incremental returns true when destination does not exist', async () => {
        fs.pathExists.mockResolvedValue(false);
        const result = await svc.shouldCopyFile('/src/a.fit', '/dst/a.fit', 'incremental');
        expect(result).toBe(true);
    });

    it('incremental returns false when size and mtime match', async () => {
        const mtime = new Date('2025-01-01T00:00:00.000Z');
        fs.pathExists.mockResolvedValue(true);
        fs.stat
            .mockResolvedValueOnce({ size: 1000, mtime })  // source
            .mockResolvedValueOnce({ size: 1000, mtime }); // dest (same)
        const result = await svc.shouldCopyFile('/src/a.fit', '/dst/a.fit', 'incremental');
        expect(result).toBe(false);
    });

    it('incremental returns true when size differs', async () => {
        const mtime = new Date('2025-01-01');
        fs.pathExists.mockResolvedValue(true);
        fs.stat
            .mockResolvedValueOnce({ size: 1000, mtime })
            .mockResolvedValueOnce({ size: 500, mtime });
        const result = await svc.shouldCopyFile('/src/a.fit', '/dst/a.fit', 'incremental');
        expect(result).toBe(true);
    });

    it('incremental returns true when source is newer', async () => {
        fs.pathExists.mockResolvedValue(true);
        fs.stat
            .mockResolvedValueOnce({ size: 1000, mtime: new Date('2025-06-01') })
            .mockResolvedValueOnce({ size: 1000, mtime: new Date('2025-01-01') });
        const result = await svc.shouldCopyFile('/src/a.fit', '/dst/a.fit', 'incremental');
        expect(result).toBe(true);
    });

    it('incremental returns true on stat error (safe default)', async () => {
        fs.pathExists.mockResolvedValue(true);
        fs.stat.mockRejectedValue(new Error('permission denied'));
        const result = await svc.shouldCopyFile('/src/a.fit', '/dst/a.fit', 'incremental');
        expect(result).toBe(true);
    });
});

// ─── isSubframeNonFit ─────────────────────────────────────────────────────────

describe('ImportService.isSubframeNonFit', () => {
    let svc;
    beforeEach(() => { svc = new ImportService(makeIo(), mockConfig); });

    it('returns true for a jpg inside a _sub directory', () => {
        expect(svc.isSubframeNonFit('M42\\2025-01-01_sub\\frame.jpg')).toBe(true);
    });

    it('returns true for a jpg inside a -sub directory', () => {
        expect(svc.isSubframeNonFit('M42\\2025-01-01-sub\\frame.jpg')).toBe(true);
    });

    it('returns false for a .fit inside a _sub directory', () => {
        expect(svc.isSubframeNonFit('M42\\2025-01-01_sub\\frame.fit')).toBe(false);
    });

    it('returns false for a jpg NOT inside any _sub directory', () => {
        expect(svc.isSubframeNonFit('M42\\frame.jpg')).toBe(false);
    });

    it('returns false for a .fit at the top level', () => {
        expect(svc.isSubframeNonFit('M42\\frame.fit')).toBe(false);
    });
});

// ─── emitProgress (throttle) ──────────────────────────────────────────────────

describe('ImportService.emitProgress throttle', () => {
    it('only emits once when called twice within the interval', () => {
        vi.useFakeTimers();
        const io = makeIo();
        const svc = new ImportService(io, mockConfig);

        svc.emitProgress('sock', { bytesCopied: 100, totalBytes: 1000 });
        svc.emitProgress('sock', { bytesCopied: 200, totalBytes: 1000 });

        expect(io.to).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
    });

    it('emits a second time after the interval has passed', () => {
        vi.useFakeTimers();
        const io = makeIo();
        const svc = new ImportService(io, mockConfig);
        svc.progressEmitInterval = 500;

        svc.emitProgress('sock', { bytesCopied: 100, totalBytes: 1000 });
        vi.advanceTimersByTime(600);
        svc.emitProgress('sock', { bytesCopied: 200, totalBytes: 1000 });

        expect(io.to).toHaveBeenCalledTimes(2);
        vi.useRealTimers();
    });
});

// ─── startImport ──────────────────────────────────────────────────────────────

describe('ImportService.startImport', () => {
    let svc, io;

    beforeEach(() => {
        io = makeIo();
        svc = new ImportService(io, mockConfig);

        // scanDirectory: one file 'frame.fit'
        fs.readdir.mockResolvedValue(['frame.fit']);
        // scanDirectory now uses lstat; startImport build-phase uses stat
        fs.lstat = vi.fn().mockResolvedValue(makeStat({ size: 100 }));
        fs.stat.mockResolvedValue(makeStat({ size: 100 }));
        fs.pathExists.mockResolvedValue(false);
        fs.ensureDir.mockResolvedValue(undefined);
    });

    it('emits import:complete after successfully copying files', async () => {
        vi.spyOn(svc, 'copyFileWithProgress').mockResolvedValue(undefined);

        await svc.startImport('/src', '/dst', 'full', 'sock-1', 'op-1');

        const completeCall = io._emitSpy.mock.calls.find(([ev]) => ev === 'import:complete');
        expect(completeCall).toBeDefined();
        expect(completeCall[1]).toMatchObject({ filesCopied: 1, status: 'completed' });
    });

    it('emits import:complete with 0 filesCopied when source is empty', async () => {
        fs.readdir.mockResolvedValue([]);

        await svc.startImport('/src', '/dst', 'full', 'sock-1', 'op-1');

        const completeCall = io._emitSpy.mock.calls.find(([ev]) => ev === 'import:complete');
        expect(completeCall).toBeDefined();
        expect(completeCall[1].filesCopied).toBe(0);
    });

    it('emits import:cancelled when cancelled during copy of multiple files', async () => {
        fs.readdir.mockResolvedValue(['a.fit', 'b.fit']);
        let copyCount = 0;
        vi.spyOn(svc, 'copyFileWithProgress').mockImplementation(async () => {
            copyCount++;
            if (copyCount === 1) svc.cancelled = true;
        });

        const result = await svc.startImport('/src', '/dst', 'full', 'sock-1', 'op-1');

        const cancelCall = io._emitSpy.mock.calls.find(([ev]) => ev === 'import:cancelled');
        expect(cancelCall).toBeDefined();
        expect(result).toMatchObject({ cancelled: true });
    });

    it('emits import:error and rethrows when top-level ensureDir fails', async () => {
        fs.ensureDir.mockRejectedValue(new Error('no disk space'));

        await expect(
            svc.startImport('/src', '/dst', 'full', 'sock-1', 'op-1')
        ).rejects.toThrow('no disk space');

        const errorCall = io._emitSpy.mock.calls.find(([ev]) => ev === 'import:error');
        expect(errorCall).toBeDefined();
    });
});

// ─── validateTransfer ─────────────────────────────────────────────────────────

describe('ImportService.validateTransfer', () => {
    let svc, io;

    beforeEach(() => {
        io = makeIo();
        svc = new ImportService(io, mockConfig);
        // scanDirectory uses lstat; validateTransfer uses stat for size checks
        fs.lstat = vi.fn().mockResolvedValue(makeStat());
    });

    it('emits validate:complete with isValid=true when source and dest sizes match', async () => {
        fs.readdir.mockResolvedValue(['frame.fit']);
        fs.stat.mockResolvedValue(makeStat({ size: 100 }));
        fs.pathExists.mockResolvedValue(true);

        await svc.validateTransfer('/src', '/dst', 'sock-1', 'op-1');

        const completeCall = io._emitSpy.mock.calls.find(([ev]) => ev === 'validate:complete');
        expect(completeCall).toBeDefined();
        expect(completeCall[1].isValid).toBe(true);
        expect(completeCall[1].mismatches).toHaveLength(0);
    });

    it('emits validate:complete with isValid=false when dest size differs', async () => {
        fs.readdir.mockResolvedValue(['frame.fit']);
        // scanDirectory now uses lstat (mocked in beforeEach); stat is only called by validateTransfer
        fs.stat
            .mockResolvedValueOnce(makeStat({ size: 100 }))  // validateTransfer: source
            .mockResolvedValueOnce(makeStat({ size: 50 }));  // validateTransfer: dest (mismatch)
        fs.pathExists.mockResolvedValue(true);

        await svc.validateTransfer('/src', '/dst', 'sock-1', 'op-1');

        const completeCall = io._emitSpy.mock.calls.find(([ev]) => ev === 'validate:complete');
        expect(completeCall).toBeDefined();
        expect(completeCall[1].isValid).toBe(false);
        expect(completeCall[1].mismatches[0].issue).toBe('size_mismatch');
    });

    it('emits validate:complete with mismatch when file is missing in dest', async () => {
        fs.readdir.mockResolvedValue(['frame.fit']);
        fs.stat.mockResolvedValue(makeStat({ size: 100 }));
        fs.pathExists.mockResolvedValue(false);

        await svc.validateTransfer('/src', '/dst', 'sock-1', 'op-1');

        const completeCall = io._emitSpy.mock.calls.find(([ev]) => ev === 'validate:complete');
        expect(completeCall).toBeDefined();
        expect(completeCall[1].isValid).toBe(false);
        expect(completeCall[1].mismatches[0].issue).toBe('missing');
    });
});
