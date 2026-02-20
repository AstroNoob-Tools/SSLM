# SSLM - SeaStar Library Manager
## Build & Packaging Guide

**Version**: 1.0.0-beta.1
**Date**: February 2026
**Audience**: Developers and maintainers

---

## Table of Contents

1. [Overview](#overview)
2. [Build Prerequisites](#build-prerequisites)
3. [Project Structure](#project-structure)
4. [Development Workflow](#development-workflow)
5. [Step 1 — Install Dependencies](#step-1--install-dependencies)
6. [Step 2 — Build the Executable](#step-2--build-the-executable)
7. [Step 3 — Build the Windows Installer](#step-3--build-the-windows-installer)
8. [Version Management](#version-management)
9. [Build Artifacts](#build-artifacts)
10. [Publishing a GitHub Release](#publishing-a-github-release)
11. [Build Troubleshooting](#build-troubleshooting)

---

## Overview

SSLM ships as a self-contained Windows installer. The build pipeline has two stages:

```
Source Code
    │
    ▼  npm run build  (via @yao-pkg/pkg)
dist/sslm.exe              ← self-contained exe (~46 MB, Node.js runtime bundled)
    │
    ▼  Inno Setup Compiler
installer/output/SSLM-Setup-vX.X.X.exe  ← distributable Windows installer
```

End users receive and run only the installer. They do **not** need Node.js, npm, or any developer tooling installed.

---

## Build Prerequisites

The following tools must be installed on the **build machine** before you can produce a release.

### Required

| Tool | Version | Purpose | Download |
|------|---------|---------|---------|
| Node.js | 18 LTS or later | Runtime for `npm` and build tools | [nodejs.org](https://nodejs.org) |
| npm | (bundled with Node.js) | Package management and build script runner | — |
| Inno Setup | 6.x | Wraps `sslm.exe` into a Windows setup wizard | [jrsoftware.org](https://jrsoftware.org/isinfo.php) |

### Required for Publishing

| Tool | Version | Purpose | Download |
|------|---------|---------|---------|
| Git | Any | Version control, tagging releases | [git-scm.com](https://git-scm.com) |
| GitHub CLI (`gh`) | Any | Creating GitHub Releases from the command line | [cli.github.com](https://cli.github.com) |

### npm Dev Dependencies (installed automatically)

These are installed by `npm install` and do not require manual setup:

| Package | Version | Purpose |
|---------|---------|---------|
| `@yao-pkg/pkg` | ^6.14.0 | Bundles Node.js runtime + app into `sslm.exe` |
| `nodemon` | ^3.0.3 | Dev-only: auto-restart server on file changes |

### Verify Prerequisites

```bash
node --version     # Must be v18.x.x or higher
npm --version      # Any recent version
git --version      # Any version
gh --version       # Any version
```

Verify Inno Setup by opening the Start Menu and searching for **Inno Setup Compiler**, or confirm the binary exists:
```
"D:\Program Files (x86)\Inno Setup 6\ISCC.exe"
```

---

## Project Structure

Key files involved in the build process:

```
SeeStarFileManager/
├── server.js                    # Application entry point (bundled into exe)
├── package.json                 # npm config: build script, pkg settings, dependencies
├── src/
│   ├── services/                # Backend services (bundled into exe)
│   └── utils/                   # Utilities (bundled into exe)
├── public/                      # Frontend assets (bundled into exe as pkg assets)
│   ├── index.html
│   ├── css/styles.css
│   ├── js/
│   └── assets/
│       ├── sslm.ico             # Windows icon (embedded into exe + installed by setup)
│       ├── sslm.png             # Installer welcome banner (161×314)
│       ├── sslmLogo.png         # Installer corner image + app header + favicon
│       └── astroNoobLogo.png    # About dialog logo
├── config/
│   └── settings.json            # Default config (bundled into exe as pkg asset)
├── installer/
│   ├── sslm.iss                 # Inno Setup script — VERSION SOURCE OF TRUTH
│   └── output/                  # ← installer output (gitignored)
│       └── SSLM-Setup-vX.X.X.exe
├── dist/                        # ← exe output (gitignored)
│   └── sslm.exe
└── documentation/
    └── BuildGuide.md            # This document
```

### `package.json` — pkg Configuration

The `pkg` section of `package.json` controls what gets bundled into `sslm.exe`:

```json
{
  "scripts": {
    "build": "pkg . --output dist/sslm.exe --icon public/assets/sslm.ico"
  },
  "pkg": {
    "targets": ["node20-win-x64"],
    "assets": [
      "public/**/*",
      "config/**/*",
      "installer/sslm.iss"
    ]
  }
}
```

- **`targets`**: Produces a Windows x64 executable with Node.js 20 bundled
- **`assets`**: Files included as virtual filesystem resources inside the exe
  - `public/**/*` — all frontend HTML, CSS, JS, and image files
  - `config/**/*` — default `settings.json` template
  - `installer/sslm.iss` — read at runtime to extract the version number
- **`--icon`**: Embeds `sslm.ico` into the exe for Explorer, taskbar, and Start Menu display

---

## Development Workflow

Use this workflow during active development. No packaging is needed.

### Start the Development Server

```bash
npm run dev
```

This starts the server via `nodemon`, which automatically restarts when any source file changes. The application is accessible at `http://localhost:3000`.

### Standard Server Start (no auto-reload)

```bash
npm start
```

Runs `node server.js` directly. Use this to test production-like behavior without the overhead of `nodemon`.

### Key Differences: Development vs Packaged

| Behaviour | Development (`npm start`) | Packaged (`sslm.exe`) |
|-----------|--------------------------|----------------------|
| Config location | `config/settings.json` (project root) | `%APPDATA%\SSLM\settings.json` |
| Browser auto-open | No | Yes (1.5 s after server starts) |
| Detection | `process.pkg` is `undefined` | `process.pkg` is defined |
| Asset location | `public/` folder on disk | Embedded virtual filesystem |

The `isPackaged` flag in `server.js` (top of file) controls this branching:
```js
const isPackaged = typeof process.pkg !== 'undefined';
```

---

## Step 1 — Install Dependencies

Run this once after cloning, and again after any changes to `package.json`:

```bash
npm install
```

This installs both production dependencies (`express`, `socket.io`, `fs-extra`, `check-disk-space`) and dev dependencies (`@yao-pkg/pkg`, `nodemon`).

To install production dependencies only (not needed for building, but useful to know):
```bash
npm install --omit=dev
```

After install, run a security audit:
```bash
npm audit
```

> **Policy**: Do not ship with known high or critical vulnerabilities. If `npm audit` reports issues, resolve them before releasing.

---

## Step 2 — Build the Executable

This step bundles the Node.js runtime, all application code, and all assets into a single self-contained Windows executable.

```bash
npm run build
```

This runs:
```
pkg . --output dist/sslm.exe --icon public/assets/sslm.ico
```

**Expected output:**
```
> pkg@x.x.x
> Targets: node20-win-x64
> Building: node20-win-x64
> ...
```

**Result**: `dist/sslm.exe` (~46 MB)

### What `pkg` Does

1. Parses `package.json` `main` entry (`server.js`) as the application entry point
2. Traces all `require()` calls to include all necessary JS modules
3. Embeds the declared `assets` (`public/**/*`, `config/**/*`, `installer/sslm.iss`) into the exe's virtual filesystem
4. Bundles the Node.js 20 runtime for Windows x64
5. Sets the embedded icon to `public/assets/sslm.ico`

### Verify the Executable

```bash
dist/sslm.exe
```

- The server should start and print the startup banner to the console
- Your default browser should open automatically at `http://localhost:3000`
- The About dialog should display the correct version number (read from the embedded `sslm.iss`)
- Config should be read from / written to `%APPDATA%\SSLM\settings.json`

---

## Step 3 — Build the Windows Installer

This step wraps `dist/sslm.exe` into a Windows setup wizard using Inno Setup.

> **Prerequisite**: `dist/sslm.exe` must exist (Step 2 must have completed successfully).

### Option A — Inno Setup GUI

1. Open `installer/sslm.iss` in **Inno Setup Compiler**
2. Press **F9** (or go to **Build → Compile**)
3. Watch the output log in the bottom panel

### Option B — Command Line (Headless)

```bash
"D:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer\sslm.iss
```

Useful for automated / scripted builds.

### Result

```
installer/output/SSLM-Setup-v1.0.0-beta.1.exe
```

The output filename is controlled by the `OutputBaseFilename` setting in `sslm.iss`:
```ini
OutputBaseFilename=SSLM-Setup-v{#AppVersion}
```

### What the Installer Does

When run by an end user, the installer:

1. Copies `sslm.exe` and `sslm.ico` to `%LOCALAPPDATA%\SSLM\`
2. Creates a Start Menu shortcut
3. Optionally creates a Desktop shortcut (user's choice)
4. Registers an uninstaller in Windows "Add or Remove Programs" (with SSLM icon)
5. Offers to launch SSLM immediately after install

> **No admin rights required**: The default install path is `%LOCALAPPDATA%\SSLM\`, which is always writable by the current user. If the user manually chooses a protected path (e.g., `C:\Program Files\`), Windows will prompt for UAC elevation.

### Installer Branding

| Setting in `sslm.iss` | File | Where it appears |
|----------------------|------|-----------------|
| `WizardImageFile` | `public/assets/sslm.png` | Left banner on Welcome & Finish pages |
| `WizardSmallImageFile` | `public/assets/sslmLogo.png` | Top-right corner on all inner pages |
| `SetupIconFile` | `public/assets/sslm.ico` | Installer exe icon |
| `UninstallDisplayIcon` | `{app}\sslm.ico` | Add/Remove Programs icon |

---

## Version Management

### Source of Truth

The canonical version is defined in `installer/sslm.iss`:

```ini
#define AppVersion "1.0.0-beta.1"
```

At runtime, `server.js` reads this value via `readAppVersion()` and exposes it through `/api/config`. The frontend displays it in the About dialog.

### Bumping the Version

Update the version in **two places** to keep them in sync:

1. **`installer/sslm.iss`** (source of truth):
   ```ini
   #define AppVersion "X.X.X"
   ```

2. **`package.json`** (informational, keeps npm metadata aligned):
   ```json
   "version": "X.X.X"
   ```

### Version Format

SSLM uses semantic versioning:

| Format | Example | Meaning |
|--------|---------|---------|
| `X.Y.Z` | `1.1.0` | Stable release |
| `X.Y.Z-beta.N` | `1.0.0-beta.2` | Pre-release / public beta |
| `X.Y.Z-alpha.N` | `2.0.0-alpha.1` | Early/unstable pre-release |

---

## Build Artifacts

| File | Location | Gitignored | Description |
|------|----------|-----------|-------------|
| `sslm.exe` | `dist/sslm.exe` | Yes | Self-contained exe built by `npm run build` |
| Setup exe | `installer/output/SSLM-Setup-vX.X.X.exe` | Yes | Windows installer built by Inno Setup |

Both `dist/` and `installer/output/` are listed in `.gitignore`. Only source code is committed; binaries are attached directly to GitHub Releases.

---

## Publishing a GitHub Release

### One-Time Setup

Authenticate the `gh` CLI (only needed once per machine):

```bash
gh auth login
```

Choose: **GitHub.com → HTTPS → Login with a web browser**

### Release Checklist

**1. Bump the version** (see [Version Management](#version-management))

**2. Run the security audit:**
```bash
npm audit
```
Resolve any high/critical issues before proceeding.

**3. Build the executable:**
```bash
npm run build
```

**4. Build the installer:**
```bash
"D:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer\sslm.iss
```

**5. Verify both artifacts exist:**
```bash
dir dist\sslm.exe
dir installer\output\SSLM-Setup-vX.X.X.exe
```

**6. Test the installer on a clean machine** (or VM) if possible:
- Run the setup wizard end-to-end
- Confirm the app launches and the correct version appears in the About dialog
- Confirm settings persist after re-running

**7. Commit and push the source code:**
```bash
git add installer/sslm.iss package.json
git commit -m "vX.X.X — description of changes"
git push origin main
```

**8. Create the GitHub Release:**

> Run as a **single line** in CMD or PowerShell — no line-continuation characters.

**Pre-release (beta):**
```
gh release create vX.X.X "installer/output/SSLM-Setup-vX.X.X.exe" --title "SSLM vX.X.X" --notes "Release notes here." --prerelease
```

**Stable release:**
```
gh release create vX.X.X "installer/output/SSLM-Setup-vX.X.X.exe" --title "SSLM vX.X.X" --notes "Release notes here."
```

**9. Verify the release:**

Open `https://github.com/AstroNoob-Tools/SSLM/releases` and confirm:
- The tag is correct (`vX.X.X`)
- The installer exe is attached as a downloadable asset
- The release notes are accurate
- The pre-release flag is set correctly

---

## Build Troubleshooting

### `npm run build` fails — "Cannot find module"

**Symptom**: `pkg` exits with a module resolution error.

**Causes and fixes:**
1. `node_modules` is missing or corrupt — run `npm install`
2. A `require()` path uses a dynamic expression that `pkg` cannot trace — ensure all imports use static string literals where possible

---

### `npm run build` fails — pkg cannot download Node.js binary

**Symptom**:
```
Error: Cannot download node binary for node20-win-x64
```

**Cause**: `@yao-pkg/pkg` downloads a pre-built Node.js binary on first use and caches it. This requires internet access.

**Fix**: Ensure internet access is available, then retry. The cached binary is stored in `~/.pkg-cache/`.

---

### `npm run build` — exe is too small

**Symptom**: `dist/sslm.exe` is only a few KB instead of ~46 MB.

**Cause**: The build likely failed silently and produced an empty/stub exe.

**Fix**: Check the build output for errors. Delete `dist/sslm.exe` and re-run `npm run build`.

---

### Inno Setup — "Source file does not exist"

**Symptom**: Inno Setup Compiler reports a missing source file error.

**Most likely cause**: `dist/sslm.exe` does not exist because Step 2 was skipped.

**Fix**: Run `npm run build` first, then recompile the `.iss` script.

---

### Inno Setup — wrong version in installer output filename

**Symptom**: The output filename shows an old version number.

**Fix**: Ensure `#define AppVersion` in `installer/sslm.iss` has been updated before compiling.

---

### About dialog shows wrong version at runtime

**Symptom**: The About dialog shows `1.0.0` (fallback) instead of the current version.

**Cause**: `readAppVersion()` in `server.js` reads the version from the embedded `installer/sslm.iss`. If that file was not listed in the `pkg` `assets` array or the `#define AppVersion` line was not updated before building, the version will be wrong.

**Fix**:
1. Confirm `installer/sslm.iss` is listed under `"assets"` in `package.json`
2. Confirm `#define AppVersion` in `sslm.iss` has the correct version
3. Rebuild with `npm run build`

---

### Settings not persisting after re-launch of packaged exe

**Symptom**: Favourites and paths are lost when `sslm.exe` is closed and reopened.

**Cause**: The packaged exe writes settings to `%APPDATA%\SSLM\settings.json`. If the app is not detecting `process.pkg` correctly, it may be trying to write to the read-only installation directory instead.

**Fix**: Verify the `isPackaged` flag in `server.js` evaluates correctly when running the exe. Check that `%APPDATA%\SSLM\` exists and is writable.

---

### `gh release create` fails — authentication error

**Symptom**:
```
Error: To get started with GitHub CLI, please run: gh auth login
```

**Fix**:
```bash
gh auth login
```

Choose: **GitHub.com → HTTPS → Login with a web browser**

---

*SSLM - SeaStar Library Manager v1.0.0-beta.1 — Build & Packaging Guide*
*Last updated: February 2026*
