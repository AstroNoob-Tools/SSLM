# SSLM - SeeStar Library Manager

## Startup — Always Read First

At the start of **every session**, read `AI_CONTEXT.md` in the project root before doing anything else.
It contains the current objective, completed tasks, open issues, and critical warnings.

---

## Branch Development Plans

When working on any branch other than `main`, always look for a corresponding plan file
in the `notes/` folder before starting work: `notes/{branch-name}-plan.md`

**At the start of every session on a feature branch:**
1. Run `git branch --show-current` to confirm the active branch.
2. Check if `notes/{branch-name}-plan.md` exists.
3. If it exists, read it before doing anything else — it defines the goals and decisions already made.
4. If it does not exist, ask the user whether to create one before proceeding.

Update the plan file as work progresses: tick off completed items and add new ones.

---

## Security Policy

**Never introduce npm packages that have known security vulnerabilities.**
- Verify no known CVEs before adding any dependency.
- Use `npm audit` after any dependency change.
- Find a safe alternative if a required package has a vulnerability.

---

## Project Overview

SSLM is a local web app (Node.js + Express) for managing SeeStar astrophotography files.
All five development phases are complete and released.

| Version | Status | Notes |
|---------|--------|-------|
| **v1.0.0-beta.4** | Current public beta | Export to Stacking, XSS/CWE-78 fixes, licensing |
| **v1.0.0-beta.4.1** | In development (`auto-update` branch) | Auto-update, Socket.IO recovery, Vitest suite |

**GitHub Releases**: https://github.com/AstroNoob-Tools/SSLM/releases

### CRITICAL SAFETY RULE
**Never work directly on the SeeStar device. All operations must be on a local copy.**

---

## Domain Context

### SeeStar Device
- Files stored under `MyWorks` on the device.
- Connection: removable drive (`E:\MyWorks`) or network (`\\seestar\MyWorks`).

### Astronomical Catalogs
Object names: Messier (`M 42`), NGC (`NGC 1365`), IC (`IC 434`), Sharpless (`SH 2-3`), named objects.
Variants: `_mosaic` suffix for mosaic captures.

### File Organization

**With sub-frames** (two directories):
```
NGC 6729/                         ← stacked images
  Stacked_210_NGC 6729_30.0s_IRCUT_20250822-231258.fit
  DSO_Stacked_214_NGC 6729_30.0s_20250822_235518.fit
NGC 6729_sub/                     ← EQ mount sub-frames  (_sub suffix)
NGC 6729-sub/                     ← Alt/Az sub-frames    (-sub suffix)
  Light_NGC 6729_30.0s_IRCUT_20250822-203353.fit
```
An object can have both `_sub` and `-sub` simultaneously (sessions on different mounts).

**Without sub-frames** (one directory):
```
M 47/
  Stacked_30_M 47_10.0s_IRCUT_20260209-233223.fit
```

### File Naming
- Stacked: `Stacked_[count]_[Object]_[exp]s_[filter]_[YYYYMMDD-HHMMSS].fit`
- DSO Stacked: `DSO_Stacked_[count]_[Object]_[exp]s_[YYYYMMDD]_[HHMMSS].fit`
- Light frames: `Light_[Object]_[exp]s_[filter]_[YYYYMMDD-HHMMSS].fit`
- Each `.fit` has matching `.jpg` and `_thn.jpg` versions.
- JPGs in `_sub`/`-sub` dirs are safe to delete (expurged mode).

---

## Technology Stack & Key Files

- **Backend**: Node.js + Express (`server.js`)
- **Frontend**: Vanilla HTML/CSS/JS (`public/`)
- **Real-time**: Socket.IO (import / merge / export progress)
- **Dev server**: `npm start` → http://localhost:3000
- **Tests**: Vitest (`npx vitest run`), 51 tests in `tests/`
- **Packaged**: `@yao-pkg/pkg` → `dist/sslm.exe`
- **Installer**: Inno Setup 6 → `installer/output/SSLM-Setup-vX.X.X.exe`

| File | Purpose |
|------|---------|
| `server.js` | Express app, all API routes, Socket.IO, operationStore |
| `installer/sslm.iss` | **Version source of truth** (`#define AppVersion`) |
| `src/services/importService.js` | Import from SeeStar device (5-step wizard backend) |
| `src/services/mergeService.js` | Merge multiple libraries (6-step wizard backend) |
| `src/services/stackExportService.js` | Export light frames for stacking |
| `src/services/fileAnalyzer.js` | Scan and analyze a library directory |
| `src/services/fileCleanup.js` | Delete session/sub-frame files |
| `src/utils/diskSpaceValidator.js` | Space checks, `formatBytes()`, `isSubframeNonFit()` |
| `src/utils/diskSpaceValidator.js` | Uses `execFile('powershell', [...])` — never `wmic` (CWE-78 fix) |
| `public/js/app.js` | App class, Socket.IO client, modal system, reconnect recovery |
| `public/js/dashboard.js` | Dashboard, object/catalog/session detail views |
| `public/js/importWizard.js` | 5-step import wizard, `pollStatus()` for disconnect recovery |
| `public/js/mergeWizard.js` | 6-step merge wizard, `pollStatus()` for disconnect recovery |
| `public/assets/` | `sslmLogo.png`, `sslm.png`, `sslm.ico`, `astroNoobLogo.png` |
| `config/settings.json` | User settings (dev only; `%APPDATA%\SSLM\` when packaged) |

### Packaged vs. Development
| Behaviour | Development (`npm start`) | Packaged (`sslm.exe`) |
|-----------|--------------------------|----------------------|
| Config location | `config/settings.json` | `%APPDATA%\SSLM\settings.json` |
| Browser auto-open | No | Yes |
| Detection | `process.pkg` undefined | `process.pkg` defined |
| Update install endpoint | HTTP 403 | Enabled |

### Rate Limiters (server.js)
- `lightLimiter` — static/cancel/check endpoints
- `analysisLimiter` — scan/analyze endpoints
- `heavyOpLimiter` — start/validate operations

### Path Security (server.js)
All user-supplied paths go through `path.resolve()` then `isAllowedPath()` before use.

---

## Service Patterns

All three copy services (`importService`, `mergeService`, `stackExportService`) share the same pattern:
- **Per-file timeout**: 30s inactivity timeout on each file copy (guards against `\\seestar` going offline mid-copy). Resets on each data chunk.
- **Abort hook**: `this._abortCurrentFile` — set by `copyFileWithProgress`/`_copyFile`, called by the cancel method for immediate abort.
- **Partial file cleanup**: On timeout or abort, the partial destination file is deleted.
- **Progress**: throttled Socket.IO emit every 500ms, enriched with speed/ETA.

### Socket.IO Events
- Import: `import:progress`, `import:complete`, `import:error`, `import:cancelled`
- Merge: `merge:progress`, `merge:complete`, `merge:error`, `merge:cancelled`
- Stack Export: `stackexport:progress`, `stackexport:complete`, `stackexport:error`, `stackexport:cancelled`
- Validation (shared): `validate:progress`, `validate:complete`, `validate:error`

### Object Data Structure (from fileAnalyzer)
```javascript
obj.name / obj.displayName      // "NGC 6729"
obj.mainFolder.path / .files
obj.subFolderEq                 // { path, files, fileCount, size } or null  (_sub)
obj.subFolderAltAz              // { path, files, fileCount, size } or null  (-sub)
obj.subFolder                   // alias → prefers Eq
obj.hasSubFrames                // boolean
obj.mountMode                   // 'eq' | 'altaz' | 'both'
this.data.path                  // library root path
```

### Frontend Globals
- `escapeHtml(s)` — always escape user data before injecting into DOM
- `app.formatBytes(bytes)`
- `app.showLoading(msg)` / `app.hideLoading()`
- `app.showModal(title, body, confirmCb, confirmLabel)`
- `app.showScreen(id)` — sets `app.currentScreen = id.replace('Screen', '')`
- `app.socket.on(event, handler)` — Socket.IO client
- `app.registerOperation(wizard)` / `app.clearOperation()` — disconnect recovery

---

## Windows Installer — Build & Release

### Bump version (three places)
1. `installer/sslm.iss` → `#define AppVersion "x.x.x"` ← **source of truth**
2. `package.json` → `"version": "x.x.x"`
3. `public/index.html` footer `<span>SSLM - SeeStar Library Manager vx.x.x</span>`

### Build
```bash
npm run build
# → dist/sslm.exe  (~46 MB, Node.js bundled)

"D:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer\sslm.iss
# → installer/output/SSLM-Setup-vX.X.X.exe
```

### Publish
```bash
gh release create vX.X.X "installer/output/SSLM-Setup-vX.X.X.exe" \
  --title "SSLM vX.X.X" --notes "..." --prerelease
```

`dist/` and `installer/output/` are gitignored — only source is committed.

---

## Notes Folder

`notes/` is tracked in git. Only `notes/HOW_TO_RELEASE.md` is local-only (gitignored).
Plan files (`notes/{branch}-plan.md`) should be committed alongside branch work.
Release notes live in `documentation/release-vX.X.X/`.

---

## Git & Commit Convention

**Never include `Co-Authored-By:` lines in commit messages.**

```
vX.X.X — short description of what changed
```
