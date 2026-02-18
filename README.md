# SSLM — SeaStar Library Manager

A local web application for managing astrophotography files from a **SeeStar telescope**. Organise, import, merge, and analyse your astronomical image collection — entirely offline, running on your own machine.

---

## Features

### Import from SeeStar
- Automatic device detection (USB drives C: through Z:, and network/station mode)
- **Full Copy** — fresh import of all files
- **Incremental Copy** — updates only new or changed files
- Real-time progress: speed, ETA, files copied, bytes transferred
- Post-import transfer validation with file integrity checks

### Interactive Dashboard
- Summary statistics: total objects, integration times, file counts, storage usage
- File type breakdown (FITS, JPG, thumbnails, MP4)
- Catalog breakdown with clickable cards (Messier, NGC, IC, Sharpless, and more)
- Object table with search, filtering, and direct navigation
- Sticky sidebar navigation — jump to any section instantly
- Dashboard button in header — return to top from anywhere

### Object & Catalog Detail Pages
- Imaging sessions grouped by date, exposure, and filter
- Exposure breakdown cards for main and sub-frame folders
- Full file lists with capture timestamps, grouped by type
- **Image Viewer** — click any JPG or thumbnail to view full-screen
- Individual sub-frame cleanup per object

### Multi-Library Merge
- Combine 2 or more library copies into one consolidated library
- Automatic duplicate detection by relative file path
- Conflict resolution: keeps the newer version by modification date
- Real-time scanning progress showing per-library file counts
- Conflict preview before any files are moved
- Post-merge integrity validation
- Auto-skips to validation when destination is already up to date

### Cleanup Tools
- Delete empty directories with one click
- Remove JPG/thumbnail preview files from sub-frame directories (`.fit` files are never touched)
- Global cleanup (all objects) or individual object cleanup
- Space savings shown before confirmation

### Favourites & Folder Browser
- Save frequently used library folders
- Quick one-click access across Import, Local Copy, and Merge workflows
- Create new folders directly from the browser

---

## Quick Start

### Requirements

- [Node.js](https://nodejs.org) v18 or later
- Windows 10 / 11

### Install & Run

```bash
# Install dependencies
npm install

# Start the application
npm start
```

Open your browser at **http://localhost:3000**

### Development Mode

```bash
npm run dev    # Auto-restarts on file changes (requires nodemon)
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [Installation Manual](documentation/InstallationManual.md) | Full installation guide, configuration, troubleshooting |
| [User Manual](documentation/UserManual.md) | Complete step-by-step user guide for all features |

---

## Project Structure

```
SeeStarFileManager/
├── config/
│   └── settings.json              # User preferences, favourites, saved paths
├── src/
│   ├── services/
│   │   ├── fileAnalyzer.js        # Library scanning and statistics
│   │   ├── fileCleanup.js         # Cleanup operations
│   │   ├── importService.js       # SeeStar device import with progress tracking
│   │   ├── mergeService.js        # Multi-library merge with conflict resolution
│   │   └── catalogParser.js       # Astronomical catalog name parsing
│   └── utils/
│       ├── directoryBrowser.js    # File system navigation and drive detection
│       └── diskSpaceValidator.js  # Strategy-aware disk space validation
├── public/
│   ├── index.html                 # Application UI
│   ├── css/styles.css             # Dark space theme
│   └── js/
│       ├── app.js                 # Core application, screen management, navigation
│       ├── dashboard.js           # Dashboard, object detail, catalog detail, image viewer
│       ├── importWizard.js        # 5-step import wizard
│       ├── mergeWizard.js         # 6-step merge wizard
│       └── modeSelection.js       # Mode selection and folder browsing
├── documentation/
│   ├── InstallationManual.md
│   └── UserManual.md
├── server.js                      # Express server and all API endpoints
└── package.json
```

---

## SeeStar File Structure

SSLM understands the SeeStar directory and file naming conventions:

```
MyWorks/
├── NGC 6729/                    ← Main folder: stacked images
│   ├── Stacked_210_NGC 6729_30.0s_IRCUT_20250822-231258.fit
│   ├── Stacked_210_NGC 6729_30.0s_IRCUT_20250822-231258.jpg
│   └── Stacked_210_NGC 6729_30.0s_IRCUT_20250822-231258_thn.jpg
├── NGC 6729_sub/                ← Sub-frame folder: individual exposures
│   ├── Light_NGC 6729_30.0s_IRCUT_20250822-203353.fit
│   └── ...
├── M 42/                        ← Object without sub-frames
│   └── Stacked_30_M 42_10.0s_IRCUT_20260101-220000.fit
└── ...
```

**Filename format:**
```
Stacked_[frames]_[Object]_[exposure]_[filter]_[YYYYMMDD-HHMMSS].fit
Light_[Object]_[exposure]_[filter]_[YYYYMMDD-HHMMSS].fit
```

**Supported catalogs:** Messier (M), NGC, IC, Sharpless (SH), named objects, mosaic variants (`_mosaic`)

---

## Configuration

`config/settings.json` is created automatically with defaults on first run.

```json
{
  "server": {
    "port": 3000,
    "host": "localhost"
  },
  "mode": {
    "online": false
  },
  "seestar": {
    "directoryName": "MyWorks"
  },
  "paths": {
    "lastSourcePath": "",
    "lastDestinationPath": ""
  },
  "preferences": {
    "defaultImportStrategy": "incremental"
  },
  "favorites": []
}
```

To change the port, update `server.port` and restart.

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status` | Server status |
| GET | `/api/analyze?path=` | Analyse a library directory |
| GET | `/api/image?path=` | Serve an image file |
| GET | `/api/favorites` | List saved favourites |
| POST | `/api/favorites/add` | Add a favourite |
| POST | `/api/favorites/remove` | Remove a favourite |
| GET | `/api/import/detect-seestar` | Detect connected SeeStar devices |
| POST | `/api/import/validate-space` | Check disk space before import |
| POST | `/api/import/start` | Start an import operation |
| POST | `/api/import/cancel` | Cancel a running import |
| POST | `/api/import/validate` | Validate transfer integrity |
| POST | `/api/merge/analyze` | Analyse sources and build merge plan |
| POST | `/api/merge/start` | Start a merge operation |
| POST | `/api/merge/cancel` | Cancel a running merge |
| POST | `/api/merge/validate` | Validate merge integrity |
| GET | `/api/browse/drives` | List available drives |
| GET | `/api/browse/directory?path=` | List directory contents |
| POST | `/api/browse/create-directory` | Create a new directory |
| POST | `/api/cleanup/empty-directories` | Delete empty directories |
| POST | `/api/cleanup/subframe-directories` | Clean sub-frame preview files |

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express |
| Real-time | Socket.IO |
| Frontend | Vanilla JavaScript (ES6+) |
| File operations | fs-extra |
| Styling | CSS3 with custom properties |

---

## Safety

- SSLM **never writes to or modifies files on the SeeStar device**
- Merge operations **never modify source libraries**
- Cleanup only removes **JPG and thumbnail preview files** — `.fit` data files are never touched
- All destructive operations require explicit confirmation
- Disk space is validated before import and merge operations begin

---

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Dashboard, local copy workflow, cleanup, favourites | ✅ Complete |
| Phase 2 | Import from SeeStar device with real-time progress | ✅ Complete |
| Phase 3 | Multi-library merge with deduplication | ✅ Complete |

**Current version**: 1.0.0 — February 2026
**Platform**: Windows 10 / 11

---

## License

ISC
