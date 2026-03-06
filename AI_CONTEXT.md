# AI Context — SSLM (SeeStar Library Manager)

## Current Objective

Harden SSLM for a stable v1.0 release by closing the remaining open issues in `notes/PRODUCTION_READINESS.md`, currently working on the `auto-update` branch.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Runtime | Node.js 20 (Windows, packaged with `@yao-pkg/pkg`) |
| Backend | Express 4 + Socket.IO 4 |
| Frontend | Vanilla HTML/CSS/JS (`public/`) |
| File I/O | `fs-extra` 11 (wraps Node `fs` with promise API) |
| Tests | Vitest 4 + Supertest — 51 tests in `tests/` |
| Packaging | `@yao-pkg/pkg` → `dist/sslm.exe`; Inno Setup 6 → installer |

No React, no TypeScript, no build step for the frontend.

---

## Architecture & Why

### Service pattern (all three copy services)
`importService.js`, `mergeService.js`, and `stackExportService.js` all share an identical copy pattern:

```
this._abortCurrentFile = null   ← set by copyFileWithProgress/cancelExport/etc.
cleanup(err)                    ← single idempotent function; destroys streams + unlinks partial file
resetTimer()                    ← 30s inactivity timer, reset on every `data` chunk
```

**Why it was written this way:**
- The SeeStar device is accessed over a network share (`\\seestar\MyWorks`). If it goes offline mid-copy, no `error` event fires — the stream just silently stalls. The inactivity timer catches this.
- `cleanup()` uses a `settled` boolean flag so it can be called from error, timeout, AND the cancel hook without double-resolving the Promise.
- `this._abortCurrentFile` allows the cancel endpoint to immediately destroy the in-flight stream without waiting for a timeout.

### Symlink guard in `scanDirectory()`
Both `importService.js` and `mergeService.js` have recursive `scanDirectory()` methods.
`fs.lstat()` is used (not `fs.stat()`) so symlinks are never followed — circular symlinks would cause infinite recursion.

### Socket.IO disconnect recovery (`operationStore`)
`server.js` has an `operationStore` Map that snapshots every progress/complete/error/cancelled emit. `GET /api/operations/:id/status` exposes the snapshot. On reconnect, `app.js` calls `wizard.pollStatus()` to replay the terminal event if the operation finished while disconnected.

### Rate limiters
Three limiters on all routes — `lightLimiter`, `analysisLimiter`, `heavyOpLimiter`. Do not remove these.

### Path security
Every user-supplied path goes through `path.resolve()` then `isAllowedPath()` in `server.js`. Never bypass this.

---

## Completed Tasks (this branch: `auto-update`)

- [x] **Issue #1** — Command injection in disk check — strict `/^[A-Za-z]$/` drive-letter validation + `execFile`; wmic removed
- [x] **Issue #2** — No operation resume/recovery — `last-operation.json` written on start; startup warning modal
- [x] **Issue #3** — Zero test coverage — Vitest suite: 51 tests (unit + integration)
- [x] **Issue #4** — No global error handlers — `unhandledRejection` + `uncaughtException` in `server.js`
- [x] **Issue #5** — Socket.IO disconnect — `operationStore` + `io.to()` wrapper; `GET /api/operations/:id/status`; wizard `pollStatus()` on reconnect
- [x] **Issue #6** — No timeout on network operations — 30s per-file inactivity timeout in all three copy services
- [x] **Issue #7** — Symlink recursion — `fs.lstat()` + `isSymbolicLink()` guard in both `scanDirectory()` methods
- [x] **Issue #8** — Windows MAX_PATH — `destPath.length > 259` guard before every copy call in all three services; skips with warning + error entry
- [x] **Issue #10** — `fs.statSync()` in `mergeService.js` → `fs.stat().then().catch()` (non-blocking, matches importService pattern)
- [x] **Issue #11** — `src/utils/logger.js` singleton; `console` overridden in `server.js`; daily log files at `%APPDATA%\SSLM\logs\sslm-YYYY-MM-DD.log`; no new dependencies
- [x] **Issue #14** — `applyConfigDefaults()` deep-merges loaded config with defaults; non-object JSON resets + re-persists
- [x] **Issue #9** — Partial file on cancel — `cleanup()` destroys streams + `fs.unlink(destPath)`
- [x] **Issue #12** — Auto-update — startup check, amber badge, download + install flow
- [x] **CLAUDE.md** — trimmed from 1685 to ~205 lines (was causing context truncation in claude-cli)
- [x] **.gitignore** — restored `notes/` as full-directory ignore; added `!documentation/release-v1.0.0-beta.4.1/**` exception

---

## Remaining Open Issues

From `notes/PRODUCTION_READINESS.md` — fix these before tagging v1.0 stable:

| # | Issue | File | Fix |
|---|-------|------|-----|
*All critical and high-priority issues are now resolved. The remaining medium-priority items (#11, #14) are also done.*

---

## Handover Instruction

**Do this first when opening the project:**

1. Run `git branch --show-current` — should be `auto-update`
2. Read `notes/auto-update-plan.md` — it defines the full scope of this branch
3. Read `notes/PRODUCTION_READINESS.md` — it is the canonical checklist of what is done/open
4. Run `npx vitest run` — all 51 tests must pass before making any changes

Then pick the next open issue (see table above) and proceed.

---

## Warnings — Do NOT Change These

### 1. `cleanup()` pattern in copy services
The `settled` boolean flag in `cleanup()` is intentional. It makes the function idempotent — safe to call from error, timeout, and cancel simultaneously. Do not refactor this into separate handlers.

### 2. `fs.lstat()` in `scanDirectory()`
`importService.js` and `mergeService.js` use `fs.lstat()` (not `fs.stat()`) deliberately. `lstat` does not follow symlinks. Changing it back to `fs.stat()` reintroduces infinite recursion on circular symlinks.

### 3. Test mocks for `fs.lstat` use direct assignment, not `vi.spyOn`
In `tests/unit/importService.test.js`, `fs.lstat` is mocked via direct assignment:
```js
fs.lstat = vi.fn().mockResolvedValue(makeStat(...))
```
`vi.spyOn(fs, 'lstat')` does NOT work for this property (CJS/ESM interop issue with how fs-extra exposes `lstat`). Do not switch to `vi.spyOn` — the tests will silently call the real OS `lstat` and fail.

### 4. `git add -f` required for files in `notes/`
`notes/` is in `.gitignore`. Already-committed files (`notes/PRODUCTION_READINESS.md`, `notes/auto-update-plan.md`) are still tracked by git, but `git add` refuses to stage changes to them. Use `git add -f notes/<filename>` for these files.

### 5. Version source of truth is `installer/sslm.iss`
When bumping the version, update three places in sync:
1. `installer/sslm.iss` → `#define AppVersion`
2. `package.json` → `"version"`
3. `public/index.html` → footer `<span>SSLM - SeeStar Library Manager vX.X.X</span>`

### 6. Commit message format
```
vX.X.X — short description of what changed
```
No `Co-Authored-By:` footers. No emoji.

### 7. `isAllowedPath()` and rate limiters
Never remove or bypass these. They are the primary security layer for this local web app.

---

## Key File Locations

| File | Role |
|------|------|
| `server.js` | Express app, all API routes, Socket.IO, operationStore, rate limiters |
| `installer/sslm.iss` | Version source of truth |
| `src/services/importService.js` | Import wizard backend |
| `src/services/mergeService.js` | Merge wizard backend |
| `src/services/stackExportService.js` | Stack export backend |
| `src/utils/diskSpaceValidator.js` | Disk space checks (uses `execFile('powershell', ...)` — not wmic) |
| `public/js/app.js` | App class, Socket.IO client, modal system, reconnect recovery |
| `public/js/importWizard.js` | 5-step import wizard + `pollStatus()` |
| `public/js/mergeWizard.js` | 6-step merge wizard + `pollStatus()` |
| `tests/` | Vitest test suite (51 tests) |
| `notes/PRODUCTION_READINESS.md` | Canonical issue tracker for v1.0 stable |
| `notes/auto-update-plan.md` | Branch plan for `auto-update` branch |
| `CLAUDE.md` | Full project instructions for Claude Code |
