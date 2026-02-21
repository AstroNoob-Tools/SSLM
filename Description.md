# SSLM — SeeStar Library Manager

> Astrophotography library management for SeeStar telescope devices.

SSLM is a self-contained Windows desktop application that helps you import, organise, and manage your astrophotography collection from a SeeStar telescope. It runs as a local web server and opens in your browser — no internet connection required.

---

## Features

- **Import from SeeStar** — copy files from a connected SeeStar device (USB or network) to local storage, with full or incremental strategies and real-time progress tracking
- **Expurged mode** — skip non-FITS files in `_sub` directories to save disk space during import or merge
- **Multi-library merge** — combine multiple SeeStar library copies into one consolidated library with intelligent duplicate detection and conflict resolution
- **Dashboard** — interactive statistics: object counts, catalog breakdowns, integration times, file sizes, and more
- **Object detail view** — per-object metadata, imaging sessions, stacking counts, and file lists
- **Session detail & delete** — view all files from a single imaging session and delete them if needed
- **Cleanup tools** — remove empty directories and unnecessary JPG/thumbnail files from `_sub` directories
- **Favourites** — quick access to frequently used library folders
- **About dialog** — version information and contact details
- **Quit button** — gracefully shuts down the server from the browser UI

---

## Installation (End Users)

Download the latest installer from the [Releases](https://github.com/AstroNoob-Tools/SSLM/releases) page.

**No prerequisites required** — Node.js is bundled inside the installer.

1. Run `SSLM-Setup-vX.X.X.exe`
2. Follow the wizard (installs to `%LOCALAPPDATA%\SSLM\` — no admin rights needed)
3. Launch SSLM from the Start Menu or Desktop shortcut
4. Your browser opens automatically at `http://localhost:3000`

User settings and favourites are stored in `%APPDATA%\SSLM\settings.json` and survive uninstall/reinstall.

---

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org) v18 or later
- npm (bundled with Node.js)

### Install & Run

```bash
git clone https://github.com/AstroNoob-Tools/SSLM.git
cd SSLM
npm install
npm start
```

Then open `http://localhost:3000` in your browser.

For auto-reload during development:
```bash
npm run dev
```

### Build the Windows Installer

Requires [Inno Setup 6.x](https://jrsoftware.org/isinfo.php) installed separately.

```bash
# Step 1 — build the self-contained exe
npm run build

# Step 2 — compile the installer (Inno Setup must be installed)
"C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer\sslm.iss
```

Output: `installer/output/SSLM-Setup-vX.X.X.exe`

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express |
| Real-time progress | Socket.IO |
| Frontend | Vanilla HTML / CSS / JavaScript |
| Packaging | `@yao-pkg/pkg` (bundles Node.js runtime) |
| Installer | Inno Setup 6.x |

---

## Project Structure

```
SSLM/
├── public/               # Frontend (HTML, CSS, JS, assets)
│   ├── assets/           # Logos and icons
│   ├── css/styles.css
│   └── js/               # app.js, dashboard.js, importWizard.js, mergeWizard.js ...
├── src/
│   ├── services/         # fileAnalyzer, importService, mergeService, fileCleanup
│   └── utils/            # directoryBrowser, diskSpaceValidator
├── installer/
│   └── sslm.iss          # Inno Setup script (source of truth for version)
├── documentation/        # User and installation manuals
├── config/               # settings.json (gitignored)
├── server.js             # Express server + API endpoints
└── package.json
```

---

## Contact

astronoob001@gmail.com
