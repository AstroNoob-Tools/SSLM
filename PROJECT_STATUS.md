# SSLM — Project Status

**Last updated**: 2026-02-19
**Current version**: 1.0.0
**Branch**: main

---

## Phase Summary

| Phase | Title | Status |
|-------|-------|--------|
| Phase 1 | Dashboard & Setup Workflow | ✅ Complete |
| Phase 2 | Import from SeeStar Device | ✅ Complete |
| Phase 3 | Multi-Library Merge | ✅ Complete |
| Phase 4 | Session Detail & Delete | ✅ Complete |

---

## Phase 1 — Dashboard & Setup Workflow ✅

- Welcome screen with mode selection (Import / Local Copy / Merge)
- Folder browser with drive detection and favourites
- Directory analysis: objects, catalogs, file counts, sizes, integration times
- Interactive dashboard with summary cards, catalog breakdown, objects table
- Object detail view with metadata, exposure breakdown, imaging sessions
- Catalog detail view (filtered per catalog)
- Sub-frame cleanup (remove JPG/thumbnails from `_sub` directories)
- Empty directory detection and deletion
- Image viewer for JPG/thumbnail files
- Settings (online/offline mode toggle)
- Favourites system persisted to `config/settings.json`

---

## Phase 2 — Import from SeeStar Device ✅

- Automatic detection of SeeStar on USB drives (C: through Z:)
- Network path support (`\\seestar\MyWorks`)
- Configurable device directory name in `config/settings.json`
- 5-step import wizard: device → strategy → destination → confirm → progress
- Two import strategies: Full Copy and Incremental (smart sync)
- Stream-based file copying (memory-efficient, handles 50 GB+)
- Real-time progress via Socket.IO: speed, ETA, files/bytes transferred
- Strategy-aware disk space validation (incremental calculates differential size)
- Create new folder during destination selection
- Post-import transfer validation (verifies all source files exist in destination)
- Cancel support at any point during import

---

## Phase 3 — Multi-Library Merge ✅

- 6-step merge wizard: sources → destination → analysis → confirm → progress → validation
- Multi-source selection (minimum 2 libraries)
- Deduplication by relative file path across all sources
- Conflict resolution: keep newer version by file modification date
- Destination scanning (files already in destination are skipped)
- Real-time analysis progress via Socket.IO (per-library scanning feedback)
- Tabular merge plan preview (Step 3) and confirmation (Step 4)
- Stream-based copying with per-source progress breakdown
- Auto-skip to validation when no files need copying
- Post-merge integrity validation
- Automatic transition to dashboard after merge + validation

---

## Phase 4 — Session Detail & Delete ✅

- Imaging sessions table: date links open Session Detail View; 🗑️ button deletes session
- Intermediate stacking snapshots merged into one session per night (keeps highest frame count)
- Stacking Counts metadata shows `[total] total ([s1], [s2] per session)`
- Session Detail View (`sessionDetailScreen`): all files for one session, expanded by default
- Delete Session: removes stacked images (main folder) + light frames (sub folder), requires confirmation
- New API endpoint: `POST /api/cleanup/session`
- Object detail refreshes automatically after session deletion or sub-frame cleanup
- Cleanup button disappears immediately after successful cleanup

---

## Bug Fixes Log

### 2026-02-14
| Issue | Fix |
|-------|-----|
| Directory browser `items` vs `directories` property mismatch | Updated `modeSelection.js` to use `data.directories` |
| Dashboard summary cards wrapping to multiple rows | Fixed grid to `repeat(6, 1fr)` |
| Object detail page loading scrolled to bottom | Added `window.scrollTo(0, 0)` after screen switch |
| Imaging sessions showing one row per file instead of per session | Implemented Map-based grouping by `date_time_exposure_filter` key |

### 2026-02-19
| Issue | Fix |
|-------|-----|
| Stale file list in object detail after sub-frame cleanup | Added `showObjectDetail()` re-render after `refreshDashboard()` |
| Cleanup button not disappearing immediately after cleanup | Added immediate DOM removal of the button on success |
| Modal Cancel button non-functional (lost listeners after `cloneNode`) | Rewrote `showModal()` to always attach fresh `addEventListener` on cloned buttons |
| Sub-frame exposure token mismatch (`"20s"` vs `"20.0s"`) | Changed to `session.exposure.toFixed(1) + 's'` in `_getSessionFiles()` |
| Stacking counts inflated 3× (`.jpg` and `_thn.jpg` counted alongside `.fit`) | Added `.endsWith('.fit')` guard in `parseImagingSessions()` and `fileAnalyzer.scanFolderFiles()` |
| Intermediate stacking snapshots shown as separate sessions | Changed session key to date-only (`YYYYMMDD_exposure_filter`); keep max frame count per group |
| Stacking Counts metadata confusing (list of raw values) | Now shows `total (per-session breakdown)` derived from parsed sessions |

---

## API Endpoints

### Analysis
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analyze?path=` | Analyse directory and return statistics |

### Favourites
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/favorites` | Get all favourites |
| POST | `/api/favorites/add` | Add favourite `{ path, name }` |
| POST | `/api/favorites/remove` | Remove favourite `{ path }` |

### Cleanup
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/cleanup/empty-directories` | Delete empty directories `{ directories }` |
| POST | `/api/cleanup/subframe-directories` | Clean sub-frame directories `{ objects }` |
| GET | `/api/cleanup/subframe-info?path=` | Get sub-frame cleanup info |
| POST | `/api/cleanup/session` | Delete all files for one session `{ mainFolderPath, subFolderPath, mainFiles[], subFiles[] }` |

### Import
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/import/detect-seestar` | Detect SeeStar devices |
| POST | `/api/import/validate-space` | Validate disk space `{ sourcePath, destinationPath, strategy }` |
| POST | `/api/import/start` | Start import `{ sourcePath, destinationPath, strategy, socketId }` |
| POST | `/api/import/cancel` | Cancel ongoing import |
| POST | `/api/import/validate` | Validate transfer integrity |

### Merge
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/merge/analyze` | Analyse source libraries `{ sourcePaths[], destinationPath }` |
| POST | `/api/merge/validate-space` | Validate disk space for merge |
| POST | `/api/merge/start` | Start merge operation |
| POST | `/api/merge/cancel` | Cancel ongoing merge |
| POST | `/api/merge/validate` | Validate merged library integrity |

### Directory Browsing
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/browse/drives` | Get available drives and common paths |
| GET | `/api/browse/directory?path=` | Get directory contents |
| GET | `/api/browse/validate?path=` | Validate a path |
| POST | `/api/browse/create-directory` | Create new directory `{ parentPath, folderName }` |

---

## Known Limitations

- Windows only (uses `wmic` for disk space and drive letter scanning)
- No FITS header reading (metadata extracted from filenames only)
- No image stacking or processing
- No telescope control

---

## Future Enhancement Ideas

- Cross-platform support (macOS, Linux)
- Windows installer package
- Backup and restore features
- Advanced filtering and sorting options
- Export capabilities (CSV, reports)
- Batch operations on multiple objects
- Stacking quality metrics
- Weather and seeing condition logging
- Image comparison tools
- Session planning and scheduling
