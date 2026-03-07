# SSLM — SeeStar Library Manager
## Release Notes — V1.0.0-Preproduction

**Release date**: March 2026
**Platform**: Windows 10 / 11
**Previous release**: v1.0.0-beta.4 (3 March 2026)

---

## What's New in beta.4.1

Beta 4.1 is a reliability and quality release. The main themes are: **auto-update**, **security hardening (CWE-78 + CWE-79 fixes)**, **crash resilience**, **Socket.IO disconnect recovery**, **network copy robustness**, **persistent logging**, **config validation**, and **merge reliability & UX improvements**. A Vitest automated test suite is also introduced as a developer-facing quality improvement. There are no breaking changes and no migration steps required.

---

## 1 — Auto-Update

SSLM can now detect and install new releases without the user visiting GitHub.

### How it works

On every launch (packaged exe only), SSLM silently calls the GitHub Releases API. If a newer version is available:

- An amber **"Update available: vX.X.X"** badge appears in the header.
- Clicking the badge opens an **Update modal** showing the version difference and a link to the release notes on GitHub.
- Clicking **Download & Install** streams the new installer directly to `%TEMP%`, showing a real-time download progress bar (speed, MB transferred).
- Once the download is complete, clicking **Install Now** launches the installer and cleanly shuts down the running SSLM instance.

### Manual check

The **About** dialog now includes a **Check for Updates** button that triggers the same check on demand, with a "You're up to date" confirmation when no update is available.

### Security

- The download URL is validated against an allowlist (`https://github.com/` and `https://objects.githubusercontent.com/`) before any bytes are transferred.
- The installer filename is validated against the pattern `/^SSLM-Setup-[\w.\-]+\.exe$/`.
- The local file path passed to the install endpoint must reside inside `%TEMP%` (path traversal guard).
- The install endpoint returns HTTP 403 in development mode (`npm start`).
- Network calls use `AbortSignal.timeout(8000)` to prevent indefinite hangs.
- One GitHub API call is made per server lifetime (session-level cache); the result is not persisted to disk.

---

## 2 — Security Hardening

### CWE-78 Command Injection in disk space check — FIXED

The disk space check in `diskSpaceValidator.js` previously used `wmic logicaldisk` via a shell `exec()` call. The drive letter was user-supplied and insufficiently validated, creating a potential command injection vector (CWE-78).

**Fix**:
- Drive letters are now validated with a strict regex (`/^[A-Za-z]$/`) before any system call.
- The call was replaced with `execFile('powershell', [...])` using PowerShell's `[System.IO.DriveInfo]` API, which is not susceptible to shell injection.
- The `wmic` fallback path has been removed entirely.

**Additional benefit**: This change also resolves a compatibility issue on Windows 11 24H2, where `wmic` was deprecated and could fail silently.

### CWE-78 Command Injection in shell launch calls — FIXED

Three additional `child_process.exec()` calls in `server.js` used template-literal string interpolation to build shell commands, which passes the string through `cmd.exe` and is susceptible to metacharacter injection (CWE-78):

| Endpoint | Old code |
|----------|----------|
| Auto browser-open on startup | `exec(\`start http://${HOST}:${PORT}\`)` |
| `POST /api/open-url` | `exec(\`start "" "${url}"\`)` |
| `POST /api/update/install` | `exec(\`start "" "${filePath}"\`)` |

**Fix**: All three replaced with `spawn('cmd', ['/c', 'start', '', target], { detached: true, stdio: 'ignore' }).unref()`. Arguments are passed as an array so `cmd.exe` never interprets them as shell text, regardless of their content.

### DOM XSS in error messages — FIXED

Four locations in the frontend rendered error text directly into `innerHTML` without HTML-escaping, creating a potential DOM-based XSS vector (CWE-79) if a server-side error message contained HTML markup:

| File | Location | Source |
|------|----------|--------|
| `public/js/importWizard.js` | Device scan error | `error.message` |
| `public/js/importWizard.js` | Disk space — API error | `data.error` |
| `public/js/importWizard.js` | Disk space — exception | `error.message` |
| `public/js/mergeWizard.js` | Analysis failure | `error.message` |

**Fix**: Each value is now wrapped with the existing global `escapeHtml()` function before insertion into the DOM.

### Snyk Code audit — false positive summary

A full Snyk Code scan of the source tree produced 63 findings. The 7 genuine issues above were fixed. The remaining 56 are confirmed false positives:

| Category | Count | Why they are not exploitable |
|----------|-------|------------------------------|
| **Path Traversal** (CWE-22) | 14 | Every user-supplied path in `server.js` is passed through `path.resolve()` then `isAllowedPath()` before reaching any `fs` call. `isAllowedPath()` rejects anything that does not resolve to a Windows drive-letter root (`X:\`) or UNC path (`\\server\share`). Snyk Code does not model custom validator functions, so it reports these as unsanitised even though the guard is present. |
| **No rate limiting** | 14 | Every flagged route already has one of the three Express rate-limiter middlewares applied at the route declaration (`lightLimiter`, `analysisLimiter`, or `heavyOpLimiter`). Snyk flags the file-system operation line inside the handler body without correlating it back to the middleware on the route definition. |
| **HTTP instead of HTTPS** | 1 | `server.js` creates an HTTP server intentionally. SSLM binds to `localhost` only and is never exposed to a network — a TLS certificate provides no meaningful security benefit for a local-only process. This is documented in a comment at `server.js:57`. |
| **Unchecked HTTP source type** | 4 | The flagged `.length` accesses use optional chaining (`?.length`), which safely returns `undefined` rather than throwing. The flagged `.replace()` calls are on values already validated by a `RegExp.test()` guard immediately above, which coerces non-strings via `toString()` and rejects invalid input before the call is reached. |
| **DOM XSS on `data-path` attributes** | ~8 | Several folder-browser lists inject Windows filesystem paths into `data-path="..."` HTML attributes without `escapeHtml()`. On Windows, path names cannot legally contain `"`, `<`, or `>` (the OS rejects them), so no HTML-breaking payload can exist in a real path. |
| **DOM XSS on static templates** | ~15 | The flagged `innerHTML` assignments are static string literals with no user-controlled data. Snyk's taint analysis traces a data flow from an earlier network call to the same code block and conservatively flags the assignment, but the injected string contains no variable interpolation from that source. |

---

## 3 — Crash Resilience

### Global error handlers

Two Node.js process-level error handlers are now registered in `server.js`:

- **`unhandledRejection`**: Logs the error and continues running. Previously an unhandled promise rejection could leave the server in an undefined state.
- **`uncaughtException`**: Logs the error and calls `gracefulShutdown()`, ensuring open handles (HTTP server, Socket.IO) are closed cleanly before the process exits.

### Interrupted operation recovery

When a long-running operation (import, merge, stack export) starts, SSLM writes a small `last-operation.json` file to `%APPDATA%\SSLM\`. This file is cleared when the operation finishes or is cancelled normally.

On the next launch, if this file is present, a warning modal is displayed:

> "A previous operation was interrupted. It may have left files in an incomplete state. Review your destination folder before starting a new operation."

This ensures users are never left silently with a partial import or merge after a power loss or crash.

---

## 4 — Socket.IO Disconnect Recovery

SSLM's long-running operations (import, merge, stack export) communicate progress to the browser via Socket.IO. If the browser loses its WebSocket connection mid-operation, the operation continues on the server but the client risks never seeing the completion event.

Beta 4.1 addresses this with a two-layer approach:

### Server-side operation store

Every operation now maintains a snapshot in an in-memory `operationStore` Map, keyed by `operationId`. The store captures:

- The **last progress event** (percentage, files copied, speed, ETA).
- The **terminal event** (`complete`, `error`, or `cancelled`) and its payload.

The snapshot is updated transparently via a wrapper on Socket.IO's `io.to().emit()` — no changes were required to any service file. Entries are automatically removed after 10 minutes.

### Polling endpoint

A new endpoint `GET /api/operations/:id/status` exposes the stored snapshot. It returns either the latest state or `{ status: "unknown" }` if the operation ID is no longer in the store.

### Client-side reconnect polling

Socket.IO reconnects automatically after a disconnect. When the connection is restored, `app.js` detects that this is a reconnect (not the initial connect) and calls `wizard.pollStatus()` on whichever wizard has an active operation. The wizard fetches the status endpoint and, if the operation has already finished, replays the terminal event handler (completing the UI exactly as if the Socket.IO event had arrived on time).

**Result**: A user who experiences a brief network hiccup during a 20-minute import will see the completion screen when their browser reconnects — even if the import finished during the gap.

---

## 5 — Automated Test Suite (Vitest)

A Vitest test suite has been added as a developer-quality improvement. It is not relevant to end users but ensures future changes do not regress critical behaviour.

### Coverage

| File | Type | Tests |
|------|------|-------|
| `tests/unit/importService.test.js` | Unit | 23 |
| `tests/unit/mergeService.test.js` | Unit | 14 |
| `tests/unit/diagnostic.test.js` | Unit | 1 |
| `tests/integration/importRoutes.test.js` | Integration | 6 |
| `tests/integration/mergeRoutes.test.js` | Integration | 7 |
| **Total** | | **53** |

Unit tests cover `shouldCopyFile` logic, `startImport` / `executeMerge` happy and error paths, cancellation, and transfer validation. Integration tests exercise the Express route layer with mocked services, validating input guards (400 responses) and correct service delegation (200 responses).

---

## 6 — Network Copy Robustness

Several edge cases that could silently corrupt or stall a copy operation are now handled.

### Per-file inactivity timeout

All three copy operations (import, merge, stack export) now apply a **30-second inactivity timeout** per file. If no data is received from the source for 30 consecutive seconds — which happens when the SeeStar device goes offline mid-copy — the operation is immediately aborted with a clear error message, the partial destination file is deleted, and the error appears in the completion summary. The timer resets on every received data chunk, so large files that are copying normally are never affected.

### Immediate cancellation

Clicking **Cancel** during a copy now aborts the in-flight stream instantly. Previously, the cancel flag was checked only between files; a large file being copied could continue until it finished. The new `_abortCurrentFile` hook allows the cancel handler to destroy the read/write streams immediately, regardless of where in the copy the operation is.

### Partial file cleanup

On any copy failure — timeout, network error, or cancellation — the partially written destination file is deleted automatically. The source file is never touched.

### Symlink recursion guard

Both the import and merge `scanDirectory()` functions now use `fs.lstat()` instead of `fs.stat()`. Symlinks are detected and skipped before recursion, preventing infinite loops from circular symlinks in the source library.

### Windows MAX_PATH protection

The Windows API silently fails for paths longer than 259 characters. All three copy loops now check the destination path length before attempting the copy. Files that would exceed the limit are skipped, logged with the exact path length, and recorded in the operation's error summary — so the user sees what was missed instead of the copy appearing to succeed.

### Event-loop safety in merge

`mergeService.js` used `fs.statSync()` (a synchronous, blocking call) inside an async copy loop to retrieve the file size for progress tracking. This has been replaced with a non-blocking `fs.stat().then().catch()` call, matching the pattern already used in `importService.js`.

---

## 7 — Persistent Structured Logging

All application log output is now written to a daily log file at `%APPDATA%\SSLM\logs\sslm-YYYY-MM-DD.log` (packaged exe) or `config/logs/sslm-YYYY-MM-DD.log` (development). This means logs are:

- **Persistent**: they survive app restarts and are available for troubleshooting after a crash.
- **Timestamped**: every line includes an ISO 8601 timestamp and severity level (`INFO`, `WARN`, `ERROR`, `DEBUG`).
- **Automatic**: no configuration required. All existing `console.log`, `console.warn`, and `console.error` calls throughout the codebase are captured automatically — the log covers the server, all services, and all utilities.

The file rotates daily (a new file is opened when the date changes). No new npm dependencies were introduced — the logger is implemented with Node.js built-in streams only.

---

## 8 — Config Schema Validation

Previously, a corrupted or manually edited `settings.json` that contained invalid JSON or an unexpected structure could crash SSLM on startup.

`settings.json` is now validated at startup:

- If the file contains invalid JSON or is not a JSON object, it is **reset to defaults** and (in the packaged exe) the clean default config is immediately written back to `%APPDATA%\SSLM\settings.json`.
- If the file is valid JSON but some sections are missing or have the wrong type, the missing sections are **filled in from defaults** while all valid user values are preserved.
- Extra top-level keys added by the API are also preserved (not silently dropped).

---

## 9 — Merge Reliability & UX Improvements

### Merge re-copy bug — FIXED

Running the same merge a second time (same sources → same destination) previously re-copied all files instead of skipping those already present.

**Root cause**: `buildMergePlan()` compared both file size and modification time (`mtime`) against existing destination files. After the first merge, the destination file's mtime was set to the copy time, not the original capture time, so the symmetrical equality check always failed and every file was added to `filesToCopy` again.

**Fix**:
- The deduplication check is now **size-only**: `needsToCopy = !existingFile || existingFile.size !== selected.size`. Since SeeStar FIT filenames encode the capture timestamp, two files at the same path with the same size are definitively the same file.
- `fs.utimes()` is called after each successful copy to preserve the source file's modification time on the destination. The call now correctly converts the ISO 8601 string stored in the merge plan to a `Date` object (`new Date(file.mtime)`) before passing it to the API.

### Drive browser back-navigation — FIXED

Once a drive was selected in the import or merge folder browser, it was not possible to navigate back to the drive list to choose a different drive.

**Root cause (mergeWizard.js)**: The `..` item used `currentPath.split('\\').slice(0,-1).join('\\')` to compute the parent path. From a drive root (`C:\`), this produces `'C:'` (truthy), so the browser attempted to navigate to `C:` rather than returning to the drives list — causing an infinite loop.

**Root cause (importWizard.js)**: The up-button handler called `path.dirname()`, a Node.js API that is not available in the browser.

**Fix**: Both wizards now use a drive-root detection regex (`/^[A-Za-z]:[\\\/]?$/`). When the current path is a drive root, navigation goes back to the drives list instead of attempting a parent traversal. Parent path calculation uses browser-safe string operations.

### Existing-files UX warning — NEW

When the merge analysis detects that files already exist in the destination, the result screen now shows a clear, prominent notice **above the statistics table** so it is the first thing visible without scrolling:

- **All files already exist**: A panel with a "← Cancel" button and an orange "Overwrite All" button replaces the previous auto-advance behaviour (which silently proceeded to validation after 2 seconds). The user must make an explicit choice.
- **Partial overlap**: An amber notice shows how many files will be skipped and how many will be copied, with an "Overwrite All Instead" option if a full re-copy is needed.
- **Overwrite All**: Triggers a fresh analysis with `forceOverwrite = true`, which bypasses the destination scan so all files are placed in `filesToCopy`, then proceeds normally to the confirmation step.

---

## Known Limitations

- The auto-update download endpoint is only available in the packaged exe. The "Check for Updates" button in the About dialog is present in development mode but the install step returns HTTP 403.
- The `operationStore` is in-memory and does not survive a server restart. If SSLM crashes during an operation, the status endpoint will return `{ status: "unknown" }` after restart. The interrupted-operation warning modal (section 3) handles this case separately.
- The rate limiter is in-memory and resets on server restart.

---

## Upgrading from beta.4

1. Download `SSLM-Setup-V1.0.0-Preproduction.exe` from the GitHub Releases page.
2. Run the installer — it will update the application in place.
3. Your settings (`%APPDATA%\SSLM\settings.json`) and favorites are preserved automatically.
4. No manual migration steps are required.

> From beta.4.1 onwards, SSLM will notify you of future updates automatically on launch.

---

## Full Changelog

| Commit | Description |
|--------|-------------|
| *(pending)* | Config schema validation (`applyConfigDefaults`); persistent structured logging (`src/utils/logger.js`) |
| *(pending)* | Windows MAX_PATH guard; `fs.statSync` → non-blocking in merge; symlink guard; per-file timeout; cancel abort hook |
| *(pending)* | Socket.IO disconnect recovery — `operationStore`, `GET /api/operations/:id/status`, wizard `pollStatus()` |
| *(pending)* | Vitest test suite — 51 tests (unit + integration) |
| `fec7dac` | Global error handlers (`unhandledRejection` + `uncaughtException`) + interrupted operation recovery |
| `c383a67` | Fix CWE-78 command injection in `diskSpaceValidator.js` — strict drive-letter validation + `execFile` |
| *(pending)* | Auto-update feature — version check, download progress, install flow |
| *(pending)* | Fix CWE-78 (3× `exec` → `spawn`) + CWE-79 (4× `escapeHtml` on error messages) — Snyk Code audit |
| *(pending)* | Merge re-copy bug — size-only dedup + `fs.utimes` fix; drive browser back-navigation fix; existing-files UX warning with Overwrite All option; `btn-warning` CSS class |

---

*SSLM - SeeStar Library Manager V1.0.0-Preproduction — Release Notes*
*March 2026*
