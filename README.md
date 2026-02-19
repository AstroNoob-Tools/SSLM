# SSLM — SeaStar Library Manager

A local desktop web application for managing astrophotography files captured with a **SeeStar S50** telescope. SSLM runs entirely on your Windows PC — no internet connection required.

---

## What It Does

- **Import** files from a connected SeeStar device (USB or Wi-Fi) to local storage
- **Analyse** your collection: objects, catalogs, integration times, sessions, file sizes
- **Browse** sessions and files with a rich detail view per celestial object
- **Delete** specific imaging sessions to reclaim space
- **Merge** multiple library copies into a single consolidated library
- **Clean up** unnecessary preview files from sub-frame directories to save disk space

## What It Does NOT Do

- SSLM never writes to, modifies, or deletes files on your SeeStar device
- SSLM does not stack or process images
- SSLM does not control the telescope

---

## Requirements

- Windows 10 or later
- [Node.js](https://nodejs.org/) v18 or later
- A SeeStar S50 library (local copy or connected device)

---

## Installation

```bash
git clone <repository-url>
cd SeeStarFileManager
npm install
```

See [documentation/InstallationManual.md](documentation/InstallationManual.md) for full details.

---

## Starting the Application

```bash
npm start
```

Then open your browser at: **http://localhost:3000**

To start with auto-reload during development:

```bash
npm run dev
```

---

## Quick Start

1. Start the application and open `http://localhost:3000`
2. Choose one of the three modes on the Welcome Screen:
   - **Import from SeeStar** — copy files from a connected device to your PC
   - **Use Local Copy** — open an existing library folder on your PC
   - **Merge Libraries** — combine multiple library copies into one

---

## Features

### Dashboard
- Summary cards: total objects, sub-frame presence, total size, file counts
- Catalog breakdown (Messier, NGC, IC, Sharpless, Named)
- Objects table with search, integration time, and per-object cleanup
- Empty directory detection and one-click cleanup

### Object Detail View
- Stacking counts: total frames + per-session breakdown
- Exposure and filter metadata
- Imaging sessions table with clickable dates and per-session delete
- Expandable file lists (main folder and sub-frames folder)
- Sub-frame cleanup button

### Session Detail View
- All stacked images and sub-frame light files for one specific session
- Session summary cards (date, frames, exposure, filter, integration)
- Delete Session button

### Import Wizard (5 steps)
- Auto-detection of SeeStar on USB drives and network path (`\\seestar`)
- Full copy or incremental (smart sync) strategies
- Real-time progress: speed, ETA, files/bytes transferred
- Post-import transfer validation

### Merge Wizard (6 steps)
- Combine 2 or more library copies
- Intelligent deduplication by relative file path
- Conflict resolution: keep newer version by modification date
- Real-time analysis progress and per-source breakdown
- Post-merge validation

### Cleanup Operations
- Delete empty directories
- Remove JPG/thumbnail previews from `_sub` directories (`.fit` files always kept)
- Delete individual imaging sessions (stacked images + light frames)

---

## Documentation

| Document | Description |
|----------|-------------|
| [documentation/UserManual.md](documentation/UserManual.md) | Full user guide |
| [documentation/InstallationManual.md](documentation/InstallationManual.md) | Installation instructions |
| [documentation/SSLM_Functionalities.md](documentation/SSLM_Functionalities.md) | Technical internals reference |

---

## Project Structure

```
SeeStarFileManager/
├── config/
│   └── settings.json          # User configuration and favourites
├── documentation/             # User and technical documentation
├── public/
│   ├── css/styles.css         # Application stylesheet
│   ├── js/
│   │   ├── app.js             # Core app (navigation, modals, status)
│   │   ├── dashboard.js       # Dashboard, object/session detail views
│   │   ├── modeSelection.js   # Welcome screen and local copy selection
│   │   ├── importWizard.js    # 5-step import wizard
│   │   └── mergeWizard.js     # 6-step merge wizard
│   └── index.html             # Single-page application shell
├── src/
│   └── services/
│       ├── catalogParser.js   # Filename and catalog name parsing
│       ├── fileAnalyzer.js    # Directory scanning and statistics
│       ├── fileCleanup.js     # Cleanup and session deletion operations
│       ├── importService.js   # File copy, incremental sync, validation
│       └── mergeService.js    # Multi-library merge and deduplication
├── server.js                  # Express server and API routes
└── package.json
```

---

## Safety

- SSLM never modifies the SeeStar device — all operations are read-only on source
- Cleanup operations require explicit user confirmation before any file is deleted
- Session deletion shows a file count in a confirmation dialog before proceeding
- Sub-frame cleanup only removes JPG/thumbnail files — `.fit` data is always preserved

---

*SSLM — SeaStar Library Manager | Last updated: February 2026*
