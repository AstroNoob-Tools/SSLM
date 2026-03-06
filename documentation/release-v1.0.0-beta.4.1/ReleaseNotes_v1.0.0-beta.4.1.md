# SSLM — SeeStar Library Manager
## Release Notes — v1.0.0-beta.4.1

**Release date**: March 2026
**Platform**: Windows 10 / 11
**Previous release**: v1.0.0-beta.4 (3 March 2026)

---

## What's New in beta.4.1

Beta 4.1 is a reliability and quality release. The four main themes are: **auto-update**, **security hardening (CWE-78 command injection fix)**, **crash resilience**, and **Socket.IO disconnect recovery**. A Vitest automated test suite is also introduced as a developer-facing quality improvement. There are no breaking changes and no migration steps required.

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
| **Total** | | **51** |

Unit tests cover `shouldCopyFile` logic, `startImport` / `executeMerge` happy and error paths, cancellation, and transfer validation. Integration tests exercise the Express route layer with mocked services, validating input guards (400 responses) and correct service delegation (200 responses).

---

## Known Limitations

- The auto-update download endpoint is only available in the packaged exe. The "Check for Updates" button in the About dialog is present in development mode but the install step returns HTTP 403.
- The `operationStore` is in-memory and does not survive a server restart. If SSLM crashes during an operation, the status endpoint will return `{ status: "unknown" }` after restart. The interrupted-operation warning modal (section 3) handles this case separately.
- The rate limiter is in-memory and resets on server restart.

---

## Upgrading from beta.4

1. Download `SSLM-Setup-v1.0.0-beta.4.1.exe` from the GitHub Releases page.
2. Run the installer — it will update the application in place.
3. Your settings (`%APPDATA%\SSLM\settings.json`) and favorites are preserved automatically.
4. No manual migration steps are required.

> From beta.4.1 onwards, SSLM will notify you of future updates automatically on launch.

---

## Full Changelog

| Commit | Description |
|--------|-------------|
| *(pending)* | Socket.IO disconnect recovery — `operationStore`, `GET /api/operations/:id/status`, wizard `pollStatus()` |
| *(pending)* | Vitest test suite — 51 tests (unit + integration) |
| `fec7dac` | Global error handlers (`unhandledRejection` + `uncaughtException`) + interrupted operation recovery |
| `c383a67` | Fix CWE-78 command injection in `diskSpaceValidator.js` — strict drive-letter validation + `execFile` |
| *(pending)* | Auto-update feature — version check, download progress, install flow |

---

*SSLM - SeeStar Library Manager v1.0.0-beta.4.1 — Release Notes*
*March 2026*
