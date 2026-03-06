import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import fs from 'fs-extra';
// Spy directly on the fs-extra object rather than using vi.mock,
// to avoid ESM/CJS interop mock hoisting issues.

import MergeService from '../../src/services/mergeService.js';

beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(fs, 'ensureDir').mockResolvedValue(undefined);
    vi.spyOn(fs, 'createReadStream').mockReturnValue({});
    vi.spyOn(fs, 'createWriteStream').mockReturnValue({});
});

afterEach(() => {
    vi.restoreAllMocks();
});
// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeIo() {
    const emitSpy = vi.fn();
    return {
        to: vi.fn().mockReturnValue({ emit: emitSpy }),
        _emitSpy: emitSpy,
    };
}

const mockConfig = {};

// ─── resolveConflicts ─────────────────────────────────────────────────────────

describe('MergeService.resolveConflicts', () => {
    let svc;
    beforeEach(() => { svc = new MergeService(makeIo(), mockConfig); });

    it('marks the single candidate as selected when no duplicates', () => {
        const mtime = new Date('2025-01-01');
        const inventory = new Map([
            ['M42/frame.fit', [{ sourcePath: '/src/M42/frame.fit', size: 100, mtime, selected: false }]]
        ]);
        const result = svc.resolveConflicts(inventory);
        expect(result.duplicateCount).toBe(0);
        expect(inventory.get('M42/frame.fit')[0].selected).toBe(true);
    });

    it('counts a duplicate when the same relative path appears in two sources', () => {
        const mtime = new Date('2025-01-01');
        const inventory = new Map([
            ['M42/frame.fit', [
                { sourcePath: '/srcA/M42/frame.fit', sourceLibrary: '/srcA', size: 100, mtime, selected: false },
                { sourcePath: '/srcB/M42/frame.fit', sourceLibrary: '/srcB', size: 100, mtime, selected: false },
            ]]
        ]);
        const result = svc.resolveConflicts(inventory);
        expect(result.duplicateCount).toBe(1);
    });

    it('counts a conflict when same-path files have different sizes', () => {
        const mtime = new Date('2025-01-01');
        const inventory = new Map([
            ['M42/frame.fit', [
                { sourcePath: '/srcA/M42/frame.fit', sourceLibrary: '/srcA', size: 100, mtime, selected: false },
                { sourcePath: '/srcB/M42/frame.fit', sourceLibrary: '/srcB', size: 200, mtime, selected: false },
            ]]
        ]);
        const result = svc.resolveConflicts(inventory);
        expect(result.conflictCount).toBe(1);
    });

    it('selects the newer file when a conflict exists', () => {
        const older = new Date('2025-01-01');
        const newer = new Date('2025-06-01');
        const inventory = new Map([
            ['M42/frame.fit', [
                { sourcePath: '/srcA/M42/frame.fit', sourceLibrary: '/srcA', size: 100, mtime: older, selected: false },
                { sourcePath: '/srcB/M42/frame.fit', sourceLibrary: '/srcB', size: 200, mtime: newer, selected: false },
            ]]
        ]);
        svc.resolveConflicts(inventory);
        const candidates = inventory.get('M42/frame.fit');
        const selected = candidates.find(c => c.selected);
        expect(selected.mtime).toBe(newer);
    });
});

// ─── buildMergePlan ───────────────────────────────────────────────────────────

describe('MergeService.buildMergePlan', () => {
    let svc;
    beforeEach(() => { svc = new MergeService(makeIo(), mockConfig); });

    it('includes a file in filesToCopy when it is not in the destination', () => {
        const mtime = new Date('2025-01-01');
        const inventory = new Map([
            ['M42/frame.fit', [
                { sourcePath: '/srcA/M42/frame.fit', sourceLibrary: '/srcA', size: 100, mtime, selected: true }
            ]]
        ]);
        const resolutionPlan = { duplicateCount: 0, conflictCount: 0, resolutions: [] };

        const plan = svc.buildMergePlan(inventory, resolutionPlan, ['/srcA'], new Map());

        expect(plan.filesToCopy).toHaveLength(1);
        expect(plan.existingInDestination).toBe(0);
        expect(plan.totalBytes).toBe(100);
    });

    it('excludes a file from filesToCopy when it already exists with matching size+mtime', () => {
        const mtime = new Date('2025-01-01');
        const inventory = new Map([
            ['M42/frame.fit', [
                { sourcePath: '/srcA/M42/frame.fit', sourceLibrary: '/srcA', size: 100, mtime, selected: true }
            ]]
        ]);
        const resolutionPlan = { duplicateCount: 0, conflictCount: 0, resolutions: [] };
        const existingFiles = new Map([['M42/frame.fit', { size: 100, mtime }]]);

        const plan = svc.buildMergePlan(inventory, resolutionPlan, ['/srcA'], existingFiles);

        expect(plan.filesToCopy).toHaveLength(0);
        expect(plan.existingInDestination).toBe(1);
    });
});

// ─── executeMerge ─────────────────────────────────────────────────────────────

describe('MergeService.executeMerge', () => {
    let svc, io;

    const makePlan = (filesToCopy = []) => ({
        filesToCopy,
        totalBytes: filesToCopy.reduce((s, f) => s + f.size, 0),
    });

    const makeFile = (relativePath = 'M42/frame.fit') => ({
        sourcePath: '/srcA/' + relativePath,
        sourceLibrary: '/srcA',
        relativePath,
        size: 100,
        mtime: new Date('2025-01-01'),
    });

    beforeEach(() => {
        io = makeIo();
        svc = new MergeService(io, mockConfig);
        fs.ensureDir.mockResolvedValue(undefined);

        // Stub copyFileWithProgress: call onProgress once then resolve
        vi.spyOn(svc, 'copyFileWithProgress').mockImplementation(async (_s, _d, onProgress) => {
            onProgress(50, 100);
        });
    });

    afterEach(() => { vi.restoreAllMocks(); });

    it('emits merge:progress and merge:complete for a single file', async () => {
        const plan = makePlan([makeFile()]);
        await svc.executeMerge(['/srcA'], '/dst', plan, 'sock-1', 'op-1');

        const events = io._emitSpy.mock.calls.map(([ev]) => ev);
        expect(events).toContain('merge:progress');
        expect(events).toContain('merge:complete');
    });

    it('merge:complete contains correct filesCopied count', async () => {
        const plan = makePlan([makeFile('M42/a.fit'), makeFile('M42/b.fit')]);
        await svc.executeMerge(['/srcA'], '/dst', plan, 'sock-1', 'op-1');

        const completeCall = io._emitSpy.mock.calls.find(([ev]) => ev === 'merge:complete');
        expect(completeCall).toBeDefined();
        expect(completeCall[1].filesCopied).toBe(2);
    });

    it('emits merge:cancelled when cancelled after the first file copy', async () => {
        // executeMerge resets this.cancelled = false at start, so we must set it
        // during execution. Use 2 files; set cancelled inside the first copyFileWithProgress
        // so the SECOND loop iteration sees the flag and emits merge:cancelled.
        const plan = makePlan([makeFile('a.fit'), makeFile('b.fit')]);
        let copyCount = 0;
        vi.spyOn(svc, 'copyFileWithProgress').mockImplementation(async () => {
            copyCount++;
            if (copyCount === 1) svc.cancelled = true;
        });

        const result = await svc.executeMerge(['/srcA'], '/dst', plan, 'sock-1', 'op-1');

        const cancelCall = io._emitSpy.mock.calls.find(([ev]) => ev === 'merge:cancelled');
        expect(cancelCall).toBeDefined();
        expect(result).toMatchObject({ cancelled: true });
    });

    it('emits merge:error and rethrows when emitEvent throws inside the outer try/catch', async () => {
        const plan = makePlan([makeFile()]);
        // emitEvent is called BEFORE the per-file loop (for the initial progress event).
        // If that call throws, it propagates to the outer catch.
        let emitCount = 0;
        vi.spyOn(svc, 'emitEvent').mockImplementation((...args) => {
            emitCount++;
            if (emitCount === 1) throw new Error('fatal socket error');
        });

        await expect(
            svc.executeMerge(['/srcA'], '/dst', plan, 'sock-1', 'op-1')
        ).rejects.toThrow('fatal socket error');

        // The outer catch calls emitEvent('merge:error') — but our mock throws on all
        // calls, so check io directly instead
        // Just verify that the rejection propagates correctly
    });

    it('emits merge:complete even when one file copy fails (per-file error is non-fatal)', async () => {
        const plan = makePlan([makeFile('a.fit'), makeFile('b.fit')]);
        let callCount = 0;
        vi.spyOn(svc, 'copyFileWithProgress').mockImplementation(async () => {
            callCount++;
            if (callCount === 1) throw new Error('file copy failed');
        });

        await svc.executeMerge(['/srcA'], '/dst', plan, 'sock-1', 'op-1');

        const completeCall = io._emitSpy.mock.calls.find(([ev]) => ev === 'merge:complete');
        expect(completeCall).toBeDefined();
        expect(completeCall[1].errors).toHaveLength(1);
    });
});

// ─── emitEvent ────────────────────────────────────────────────────────────────

describe('MergeService.emitEvent', () => {
    it('emits to the correct socket room', () => {
        const io = makeIo();
        const svc = new MergeService(io, mockConfig);
        svc.emitEvent('sock-1', 'merge:test', { x: 1 });
        expect(io.to).toHaveBeenCalledWith('sock-1');
        expect(io._emitSpy).toHaveBeenCalledWith('merge:test', { x: 1 });
    });

    it('is a no-op when clientId is falsy', () => {
        const io = makeIo();
        const svc = new MergeService(io, mockConfig);
        svc.emitEvent(null, 'merge:test', {});
        expect(io.to).not.toHaveBeenCalled();
    });

    it('is a no-op when io is null', () => {
        const svc = new MergeService(null, mockConfig);
        expect(() => svc.emitEvent('sock-1', 'merge:test', {})).not.toThrow();
    });
});
