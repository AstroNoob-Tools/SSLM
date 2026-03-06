# Plan: Auto-Update / Check for Update Feature

## Branch
Work on branch `auto-update` (created from `main`).
Plan file: `notes/auto-update-plan.md` (copy this plan there after branch is created).

```bash
git checkout -b auto-update
```

## Context
SSLM is distributed as a self-contained Windows installer (Inno Setup). Users have no way to
know when a new version is available unless they check GitHub manually. This feature adds:
- An automatic version check on every launch (packaged exe only)
- A dismissible "Update available" notification badge in the header
- A "Check for Updates" button inside the About modal
- A full download-and-install flow so the user never has to leave the app

---

## Approach

### Version check strategy
- Call `GET https://api.github.com/repos/AstroNoob-Tools/SSLM/releases` (not `/latest` — that
  skips pre-releases, and SSLM is currently in beta)
- Take `releases[0]` (most recent, including pre-releases)
- Strip leading `v` from `tag_name`, compare with `APP_VERSION` using simple semver parse
- Result cached in-memory for the session (one network call per server lifetime)

### Update flow
1. **On startup** (frontend `init()`): call `/api/update/check`
2. If `hasUpdate`: show a pill badge in the header — "Update available: vX.X.X"
3. Clicking badge opens **Update modal** (version diff table + Download & Install button)
4. About modal gains a **"Check for Updates"** button that triggers the same check manually
5. User clicks "Download & Install":
   - Backend streams installer to `%TEMP%\SSLM-Setup-vX.X.X.exe` via Socket.IO progress events
   - Modal shows download progress bar
   - On completion: "Install Now" button appears
6. User clicks "Install Now":
   - Backend validates file path (must be in %TEMP%, match `SSLM-Setup-*.exe`)
   - `exec('start "" "path\\to\\installer.exe"')` then `gracefulShutdown()`

---

## Files to modify

| File | Change |
|------|--------|
| `server.js` | Add 3 endpoints + version compare helper + session-level cache |
| `public/index.html` | Add `#updateBadge` element in `.header-controls` |
| `public/js/app.js` | Add update check/notification/modal/download logic; enhance `showAbout()` |
| `public/css/styles.css` | Add `.update-badge` pill style (amber) + download progress bar |

---

## Backend: New Endpoints (`server.js`)

### Helper — `compareVersions(a, b)` (module-level)
Simple semver comparator that handles `1.0.0-beta.4` style versions.
Returns `1` if a > b, `-1` if a < b, `0` if equal.
Strip `v` prefix, split on `.` and `-`, compare numerically segment by segment.

### Session cache (module-level)
```js
let updateCheckCache = null; // { hasUpdate, currentVersion, latestVersion, downloadUrl, releaseUrl }
```

### `GET /api/update/check` — lightLimiter
- If `updateCheckCache` is set, return it immediately
- Call `https://api.github.com/repos/AstroNoob-Tools/SSLM/releases` with:
  - `AbortSignal.timeout(8000)`
  - `User-Agent: SSLM-App` header (GitHub API requires User-Agent)
- Take `data[0]` (latest release including pre-releases)
- Find asset: `assets.find(a => a.name.startsWith('SSLM-Setup-') && a.name.endsWith('.exe'))`
- Compare tag version with `APP_VERSION` via `compareVersions()`
- Cache and return `{ hasUpdate, currentVersion, latestVersion, downloadUrl, releaseUrl }`
- On any error: return `{ hasUpdate: false, error: message }` (never throws to client)

### `POST /api/update/download` — heavyOpLimiter
- Body: `{ downloadUrl, fileName, socketId }`
- Security: validate `downloadUrl` starts with `https://github.com/` or `https://objects.githubusercontent.com/`
- Destination: `path.join(os.tmpdir(), fileName)` — validate fileName matches `/^SSLM-Setup-[\w.\-]+\.exe$/`
- Stream download using native `fetch` + `response.body` ReadableStream
- Emit `update:progress { bytesDownloaded, totalBytes, percent }` via Socket.IO (throttled 500ms)
- Emit `update:complete { filePath }` on finish
- Return `{ success: true, filePath }` to HTTP caller

### `POST /api/update/install` — lightLimiter
- Body: `{ filePath }`
- Security: validate `filePath` starts with `os.tmpdir()` and matches `SSLM-Setup-*.exe`
- Only allowed when `isPackaged` (return 403 in dev mode)
- `exec(`start "" "${filePath}"`)` (Windows shell launches installer detached)
- After 500ms: call `gracefulShutdown()`

---

## Frontend: `public/index.html`

Add `#updateBadge` in `.header-controls` **before** `#dashboardBtn`:
```html
<span class="update-badge" id="updateBadge" style="display:none;" title="Update available">
    <span class="update-badge-dot"></span>
    <span id="updateBadgeText">Update available</span>
    <button class="update-badge-dismiss" id="updateBadgeDismiss" title="Dismiss">✕</button>
</span>
```

---

## Frontend: `public/js/app.js`

### On startup (`init()` method)
After `loadConfig()`, call `this.checkForUpdates()`.

### `checkForUpdates(silent = true)`
- `fetch('/api/update/check')`
- If `hasUpdate`: call `showUpdateNotification(result)`
- If `!silent` and `!hasUpdate`: show a quick toast/modal "You're up to date (vX.X.X)"

### `showUpdateNotification(info)`
- Set `#updateBadgeText` to `Update available: v${info.latestVersion}`
- Show `#updateBadge` (remove `display:none`)
- `#updateBadge` click → `showUpdateModal(info)` (ignore dismiss button click via `stopPropagation`)
- `#updateBadgeDismiss` click → hide badge

### `showUpdateModal(info)`
Build modal HTML with:
- Version table: Current `vX` → Latest `vY` (green arrow)
- "Release notes on GitHub" link → `info.releaseUrl` (opens in browser via `/api/open-url` or just `window.open`)
- "Download & Install" button (calls `startUpdateDownload(info)`)
- "Later" button (closes modal)

### `startUpdateDownload(info)`
- Replace modal body with a progress section:
  - Filename, progress bar, "X MB / Y MB", speed
- Register `app.socket.on('update:progress', ...)` and `app.socket.on('update:complete', ...)`
- `POST /api/update/download` with `{ downloadUrl, fileName, socketId: app.socket.id }`
- On `update:complete`: show "Install Now" button → calls `installUpdate(filePath)`

### `installUpdate(filePath)`
- `POST /api/update/install` with `{ filePath }`
- Show "Installing… the app will close." message
- App then shuts down server-side (no further action needed from JS)

### `showAbout()` enhancement
Add a "Check for Updates" row to the table:
```html
<tr>
  <td>Updates</td>
  <td><button id="checkUpdateBtn">Check for Updates</button></td>
</tr>
```
Wire `#checkUpdateBtn` to call `this.checkForUpdates(false)` then close modal.

---

## Frontend: `public/css/styles.css`

### `.update-badge` — amber pill (similar to `.mode-indicator`)
```css
.update-badge {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.75rem;
    background: rgba(255, 170, 0, 0.15);
    border: 1px solid rgba(255, 170, 0, 0.4);
    border-radius: 20px;
    font-size: 0.8rem;
    cursor: pointer;
    color: #ffaa00;
}
.update-badge-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: #ffaa00;
    box-shadow: 0 0 6px #ffaa00;
}
.update-badge-dismiss {
    background: none; border: none;
    color: inherit; cursor: pointer;
    font-size: 0.75rem; padding: 0 0 0 0.25rem;
    opacity: 0.7;
}
.update-badge-dismiss:hover { opacity: 1; }
```

### Download progress bar
Reuse existing `.progress-bar` / `.progress-fill` styles (already in styles.css for import/merge).

---

## Security checklist
- `downloadUrl` must match `https://github.com/` or `https://objects.githubusercontent.com/`
- `fileName` must match regex `/^SSLM-Setup-[\w.\-]+\.exe$/` before `path.join(tmpdir, fileName)`
- `filePath` in `/api/update/install` must start with `os.tmpdir()` (path traversal guard)
- Install endpoint returns 403 when not `isPackaged`
- No shell interpolation of user input — filePath passed as argument string only to `exec('start "" "..."')`

---

## Reused patterns
- `AbortSignal.timeout(8000)` + native `fetch` — same as SIMBAD proxy (`server.js` ~line 1083)
- `gracefulShutdown()` — same as `/api/quit` (`server.js` ~line 1189)
- Socket.IO progress throttle pattern — same as import/merge services
- `app.showModal()` + `app.socket.on()` — same as import wizard download modal
- Rate limiter assignment — `lightLimiter` for check, `heavyOpLimiter` for download/install

---

## Verification
1. Run `npm start` (dev mode)
2. Temporarily set `APP_VERSION = '0.0.1'` in server.js to force `hasUpdate: true`
3. Confirm amber update badge appears in header on load
4. Confirm clicking badge opens update modal with version diff
5. Confirm About modal "Check for Updates" button works when badge is dismissed
6. Confirm "Download & Install" shows progress (mock a slow connection if needed)
7. Restore real version; confirm "You're up to date" message appears
8. In packaged exe: end-to-end test (badge → download → installer launches → app closes)
