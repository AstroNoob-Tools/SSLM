// Diagnostic test to understand what vi.mock returns for fs-extra
// in a CJS module context

import { describe, it, expect, vi, beforeEach } from 'vitest';

const fsMock = {
    readdir: vi.fn(),
    stat: vi.fn(),
    pathExists: vi.fn(),
    ensureDir: vi.fn(),
};

vi.mock('fs-extra', () => {
    const m = {
        readdir: vi.fn(),
        stat: vi.fn(),
        pathExists: vi.fn(),
        ensureDir: vi.fn(),
    };
    return { default: m, ...m };
});

// Import the real service AFTER vi.mock
import importServiceModule from '../../src/services/importService.js';

describe('diagnostic: does vi.mock intercept CJS require for fs-extra?', () => {
    it('should return mocked stat', async () => {
        // Import the fs mock to check what the module sees
        const fs = await import('fs-extra');
        const mtime = new Date('2025-01-01');
        // Try setting on the default export
        if (fs.default && fs.default.stat) {
            fs.default.stat.mockResolvedValue({ size: 999, mtime });
            fs.default.pathExists.mockResolvedValue(true);
        } else if (fs.stat) {
            fs.stat.mockResolvedValue({ size: 999, mtime });
            fs.pathExists.mockResolvedValue(true);
        }

        const svc = new importServiceModule({ to: vi.fn().mockReturnValue({ emit: vi.fn() }) }, { seestar: { directoryName: 'MyWorks' } });
        const result = await svc.shouldCopyFile('/src/a.fit', '/dst/a.fit', 'incremental');

        // Log the fs object shape
        console.log('fs.default keys:', Object.keys(fs.default || fs));
        console.log('result:', result);
        console.log('stat call count:', (fs.default?.stat || fs.stat)?.mock?.calls?.length);

        // We just want to see what happens
        expect(result).toBeDefined();
    });
});
