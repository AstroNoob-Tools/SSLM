# SSLM - SeaStar Library Manager

## Security Policy

### CRITICAL: npm Package Security
**⚠️ IMPORTANT: Never introduce npm packages that have known security vulnerabilities.**
- Before adding any new npm dependency, verify it has no known CVEs or security advisories
- Prefer well-maintained packages with active security track records
- Avoid packages that are deprecated, abandoned, or have unresolved high/critical vulnerabilities
- Use `npm audit` after any dependency change to check for vulnerabilities
- If a required package has a vulnerability, find a safe alternative or implement the functionality without the dependency

## Project Overview

SSLM (SeaStar Library Manager) is an application that manages astrophotography files from a SeeStar telescope device. The primary goals are to:
- Import and maintain local copies of SeeStar device content (never work directly on device)
- Organize astronomical images by celestial objects
- Provide dashboard with collection statistics (objects, sub-frames, etc.)
- Manage both import and local copy scenarios
- Clean up unnecessary files to optimize storage

### Release Status

| Version | Status | Date | Notes |
|---------|--------|------|-------|
| **v1.0.0-beta.1** | 🟡 **Current — Public Beta** | February 2026 | First public release. Windows installer available on GitHub Releases. |

**GitHub Releases**: https://github.com/AstroNoob-Tools/SSLM/releases

### Current Development Phase

All four phases are complete. The application has been packaged and released as a self-contained Windows installer.

**Phase 1 - COMPLETE**: Initial setup workflow and dashboard implementation
- ✅ User selection: Import from SeeStar or use existing local copy
- ✅ Interactive dashboard with collection statistics
- ✅ Object detail pages with comprehensive metadata
- ✅ Catalog detail pages for catalog-specific views
- ✅ Cleanup operations for optimizing storage
- ✅ Favorites system for quick folder access

**Phase 2 - COMPLETE**: Direct import functionality from SeeStar device
- ✅ Automatic device detection (removable drives and network paths)
- ✅ Configurable SeeStar directory name (MyWorks)
- ✅ Full copy and incremental copy strategies
- ✅ Real-time progress tracking with Socket.IO
- ✅ Disk space validation before import (strategy-aware for incremental)
- ✅ Folder creation capability during import
- ✅ 5-step wizard workflow with visual feedback
- ✅ Transfer validation with real-time progress display
- ✅ Post-import completion UI with "Done" button
- ✅ Expurged mode: selectively skip non-.fit files from `_sub` directories
- ✅ Space savings preview when Expurged mode is selected
- ✅ Indeterminate progress bar during preparation/scan phase
- ✅ Total elapsed time counter on progress screen
- ✅ Single-row stats layout with colour-coded time indicators
- ✅ Expurged-aware transfer validation (no false missing-file errors)

**Phase 3 - COMPLETE**: Multi-library merge functionality
- ✅ Combine multiple SeeStar library copies into one consolidated library
- ✅ Intelligent duplicate detection by relative file path
- ✅ Automatic conflict resolution (keep newer version by modification date)
- ✅ 6-step merge wizard UI with analysis preview
- ✅ Real-time progress tracking with Socket.IO
- ✅ Post-merge validation for integrity verification
- ✅ Read-only operations on all source libraries (safety first)
- ✅ Disk space validation for merged library size (deduplicated calculation)
- ✅ Tabular display for merge statistics and confirmation
- ✅ Compact header design for better screen space utilization
- ✅ Expurged mode: selectively skip non-.fit files from `_sub` directories during merge
- ✅ Continuous merge progress feedback (immediate start event + per-chunk updates)
- ✅ Step 4 footer button is "Start Merge →" — no more ambiguous dual-button confusion

**Phase 4 - COMPLETE**: Windows installer & application branding
- ✅ Self-contained `sslm.exe` built with `@yao-pkg/pkg` (Node.js runtime bundled)
- ✅ Windows installer built with Inno Setup 6 (`installer/sslm.iss`)
- ✅ Installs to `%LOCALAPPDATA%\SSLM\` — no admin rights required
- ✅ Browser auto-opens on first launch (packaged mode only)
- ✅ User config stored in `%APPDATA%\SSLM\settings.json` (survives reinstall)
- ✅ Application icons: `sslm.ico` embedded in exe + installed alongside
- ✅ Installer wizard branding: `sslm.png` banner + `sslmLogo.png` corner image
- ✅ Add/Remove Programs icon via `UninstallDisplayIcon`
- ✅ About dialog: version (read from `sslm.iss`) + contact email
- ✅ Quit button (⏻): confirmation → `POST /api/quit` → graceful server shutdown
- ✅ Application logos: `sslmLogo.png` (header + favicon), `sslm.png` (welcome screen), `astroNoobLogo.png` (About dialog)
- ✅ Version source of truth: `#define AppVersion` in `installer/sslm.iss`
- ✅ Published to GitHub Releases as `v1.0.0-beta.1`

## Domain Context

### SeeStar Device
SeeStar is an astrophotography telescope that captures images of celestial objects. Files are stored on the device under a root directory called `MyWorks`.

**Connection Methods**:
1. **Removable/External Drive** (default): SeeStar appears as a drive letter (e.g., E:\, F:\)
   - Access path: `E:\MyWorks` or `F:\MyWorks` (depending on assigned drive letter)
   - Most common connection method

2. **Network Drive** (station mode): SeeStar accessible via network
   - Network path: `\\seestar\MyWorks`
   - Available when SeeStar is in station mode with network connectivity
   - Application should offer this as an alternative connection option

### Astronomical Catalogs
Objects are named using standard astronomical catalog designations:
- **Messier (M)**: e.g., M 42 (Orion Nebula), M 45 (Pleiades), M 47, M 48, M 78
- **New General Catalogue (NGC)**: e.g., NGC 1365, NGC 2024, NGC 3109, NGC 6729
- **Index Catalogue (IC)**: e.g., IC 434, IC 1284, IC 2177, IC 2602, IC 4592
- **Sharpless (SH)**: e.g., SH 2-3, SH 2-54
- **Named Objects**: e.g., Large Magellanic Cloud
- **Variants**: Some objects may have suffixes like `_mosaic` for mosaic captures

### File Formats
- **.fit (FITS)**: Flexible Image Transport System - standard astronomical image format containing scientific data
- **Image files**: .jpg, .tiff - standard image formats for viewing
- **Thumbnail files**: _thn.jpg - small preview images

## File Organization Structure

### Pattern 1: Captures With Subframes

When images are captured with sub-frames enabled, two directories are created:

#### Main Object Directory (e.g., `NGC 6729/`)
Contains stacked/processed final images:
- **Stacked images**: `Stacked_[count]_[ObjectName]_[exposure]_[filter]_[timestamp].fit`
  - Example: `Stacked_210_NGC 6729_30.0s_IRCUT_20250822-231258.fit`
- **DSO Stacked images**: `DSO_Stacked_[count]_[ObjectName]_[exposure]_[timestamp].fit`
  - Example: `DSO_Stacked_214_NGC 6729_30.0s_20250822_235518.fit`
- **Corresponding files**: Each .fit file has matching .jpg and _thn.jpg versions

**File naming components:**
- `[count]`: Number of sub-frames stacked (e.g., 210, 214, 270, 484)
- `[ObjectName]`: Catalog name (e.g., NGC 6729)
- `[exposure]`: Exposure time per frame (e.g., 30.0s, 10.0s)
- `[filter]`: Filter used (e.g., IRCUT, LP - Light Pollution filter)
- `[timestamp]`: Date and time in format YYYYMMDD-HHMMSS

#### Sub-frames Directory (e.g., `NGC 6729_sub/`)
Contains individual light frames (sub-exposures):
- **Light frames**: `Light_[ObjectName]_[exposure]_[filter]_[timestamp].fit`
  - Example: `Light_NGC 6729_30.0s_IRCUT_20250822-203353.fit`
- **Corresponding files**: Each .fit has matching .jpg and _thn.jpg versions
- **Note**: JPG files in `_sub` directories are not needed and can be deleted to save space

### Pattern 2: Captures Without Subframes

When images are captured without sub-frames, only one directory exists:

#### Object Directory (e.g., `M 47/`)
Contains only final images:
- **Stacked images**: Same naming pattern as above
  - Example: `Stacked_30_M 47_10.0s_IRCUT_20260209-233223.fit`
- **Image files**: .fit, .jpg, _thn.jpg versions
- **No _sub directory**: Sub-frames were not saved

## Usage Scenarios

### Scenario 1: Import from Connected SeeStar
When the user chooses to import from SeeStar:
1. **Device Detection**:
   - Check for SeeStar as removable drive (E:\, F:\, etc.)
   - OR allow user to specify network path (`\\seestar`)
   - Verify `/MyWorks` directory exists on device

2. **Import Type Selection**:
   - **Copy Everything**: Fresh full copy of all files (for new imports)
   - **Incremental Copy**: Only new/modified files (for existing repositories)

3. **Destination Selection**:
   - Prompt for local destination path
   - Verify sufficient disk space (up to 50GB required)

4. **Copy Operation**:
   - Copy files from SeeStar to local storage
   - Show progress indicator (files copied, MB transferred, time remaining)
   - **Never modify files on the SeeStar device itself**

5. **Completion**:
   - Display dashboard with collection statistics

### Scenario 2: Work with Existing Local Copy
When the user has an existing local copy:
1. SeeStar device may or may not be connected (doesn't matter)
2. User has previously imported/copied files from device to computer
3. Application prompts for location of the existing local copy directory
4. Validate directory structure
5. Load and display dashboard immediately

## Application Workflow & Features

### CRITICAL SAFETY RULE
**⚠️ IMPORTANT: The application MUST NEVER work directly on the SeeStar device's hard drive.**
- Always work on a local copy of the data
- All operations must be performed on local storage only
- This prevents data corruption or loss on the original device

### First Steps (Initial Application Flow)

1. **Mode Selection**
   - Prompt user: "Do you want to import content from SeeStar or work with an existing local copy?"
   - Two options:
     - **Import from SeeStar**: Copy files from connected SeeStar device to local drive
     - **Work with local copy**: Use existing local copy on computer

2. **Import Process** (if user chooses to import)

   a. **Device Connection**:
   - Detect SeeStar as removable drive (auto-detect E:\, F:\, etc.)
   - OR allow manual network path entry: `\\seestar`
   - Verify `/MyWorks` directory exists

   b. **Import Strategy**:
   - Ask: "Is this a fresh copy or updating an existing repository?"
   - **Copy Everything**: Full copy of all files (new import)
   - **Incremental Copy**: Only new/changed files (update existing)

   c. **Destination Selection**:
   - Ask: "Where should the local copy be placed?"
   - Important considerations:
     - SeeStar can contain up to **50GB of data**
     - Ensure sufficient disk space is available
     - Recommended to use a dedicated directory for organization

   d. **Copy Operation**:
   - Copy files from SeeStar `/MyWorks` to chosen local directory
   - Show real-time progress:
     - Current file being copied
     - Number of files copied / total files
     - Data transferred (MB/GB)
     - Estimated time remaining

3. **Local Copy Selection** (if user chooses existing copy)
   - Display list of favorite folders (if any)
   - User can select from favorites for quick access
   - Or browse for folder using folder browser
   - Add frequently used folders to favorites with ⭐ button
   - Validate the selected directory contains expected SeeStar file structure

4. **Dashboard Display**
   - Once setup is complete (copy finished or local directory selected), display interactive web-based dashboard:

   **Core Statistics**:
   - **Total number of objects** present in the collection
   - **Number of objects with sub-frames** (paired directories: ObjectName + ObjectName_sub)
   - **Number of objects without sub-frames** (single directory only)

   **Additional Statistics** (optional):
   - Total disk space used by collection
   - Breakdown by catalog type (Messier, NGC, IC, SH)
   - Date range of captures
   - Most recent captures
   - Average stacking counts

   **Interactive Features**:
   - Clickable object names to view details
   - Filter/sort capabilities
   - Visual charts/graphs for statistics
   - Refresh button to update statistics
   - Settings/configuration access

### Future Features
Further functionality will be defined after the dashboard is implemented and finalized.

## Key Requirements

### Initial Setup
1. **Safety First**: Never work directly on SeeStar drive - always use local copy
2. **Mode Selection**: Determine if importing from SeeStar or using existing local copy
3. **Path Selection**: Prompt user for appropriate directory:
   - If importing: Destination for local copy (consider 50GB capacity)
   - If using local copy: Location of existing local copy
4. **Data Import**: If importing, copy files from SeeStar to local storage with progress indication

### File Management
1. **Organization**: Handle both with-subframes and without-subframes patterns
2. **Catalog Support**: Recognize and organize files by astronomical catalog naming (M, NGC, IC, SH)
3. **File Cleanup**: Identify and optionally remove unnecessary JPG files from `_sub` directories
4. **Directory Pairing**: Understand relationship between object directories and their `_sub` counterparts

### Data Validation
- Verify directory structure matches expected patterns
- Identify paired directories (ObjectName / ObjectName_sub)
- Validate file naming conventions
- Handle special characters in object names (spaces, hyphens)

## Example Data

Reference directory: `H:\SeeStar-20260212`

This directory contains real-world examples of:
- Multiple celestial objects with various configurations
- Both with-subframes and without-subframes captures
- Different catalog types (M, NGC, IC, SH)
- Mosaic captures
- Various exposure times and filters

Use this as a reference for testing and understanding actual file organization patterns.

## Technology Stack

### Architecture
**Local Web Application** - Runs on user's machine without requiring internet connectivity

### Core Requirements
- **Backend**: Local web server (Python Flask/FastAPI or Node.js Express)
- **Frontend**: HTML/CSS/JavaScript for interactive dashboard
- **Mode Support**:
  - **Offline Mode** (default): Full functionality without internet
  - **Online Mode** (optional): Additional features when internet is available
- **Platform**: Windows initially (with potential cross-platform support)

### Key Capabilities
- File system operations and directory management
- Device detection (drive letter or network path)
- Interactive web-based user interface
- Progress tracking for file operations
- Dashboard with real-time statistics

## Windows Installer (Phase 4 - COMPLETE)

### Overview
SSLM ships as a self-contained Windows installer. The end user does **not** need Node.js installed — the Node.js runtime is bundled inside the executable.

### Toolchain

| Tool | Purpose | Location |
|------|---------|----------|
| `@yao-pkg/pkg` (npm dev dep) | Bundles Node.js runtime + app code into a single `sslm.exe` | `npm run build` |
| Inno Setup 6.x (external, free) | Wraps `sslm.exe` into a Windows setup wizard | [jrsoftware.org](https://jrsoftware.org/isinfo.php) |

### Build Process

**Step 1 — Build the executable:**
```bash
npm run build
# Produces: dist/sslm.exe (~46 MB, self-contained, with embedded icon)
```
The `--icon public/assets/sslm.ico` flag is included in the build script so the correct icon appears in Explorer, the taskbar, and Start Menu shortcuts.

**Step 2 — Build the installer:**
- Open `installer/sslm.iss` in Inno Setup Compiler and press F9
- OR run headlessly: `"C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer\sslm.iss`
- Produces: `installer/output/SSLM-Setup-v1.0.0-beta.1.exe`

### What the Installer Does
1. Installs `sslm.exe` + `sslm.ico` to `%LOCALAPPDATA%\SSLM\` (no admin/UAC required)
2. Creates Start Menu shortcut
3. Optionally creates Desktop shortcut (user choice during install)
4. Registers uninstaller in Windows "Add or Remove Programs" (with SSLM icon)
5. Offers to launch the app immediately after install

### Installer Branding (sslm.iss)

| Setting | File used | Where it appears |
|---------|-----------|-----------------|
| `WizardImageFile` | `public/assets/sslm.png` | Left banner on Welcome & Finish pages |
| `WizardSmallImageFile` | `public/assets/sslmLogo.png` | Top-right corner on all inner pages |
| `SetupIconFile` | `public/assets/sslm.ico` | Installer exe icon |
| `UninstallDisplayIcon` | `{app}\sslm.ico` | Add/Remove Programs icon |

### Packaged vs Development Behaviour

| Behaviour | Development (`npm start`) | Packaged (`sslm.exe`) |
|-----------|--------------------------|----------------------|
| Config location | `config/settings.json` | `%APPDATA%\SSLM\settings.json` |
| Browser auto-open | No | Yes (1.5 s after server starts) |
| Detection | `process.pkg` is undefined | `process.pkg` is defined |

**Config in APPDATA**: When running as a packaged exe the installation folder (`%LOCALAPPDATA%\SSLM\`) is read-only for user accounts. All user settings (favourites, last paths, etc.) are therefore stored in `%APPDATA%\SSLM\settings.json`, which is fully writable. On first run the default config is written there automatically.

### Application Header Features

The top header bar contains the following controls (left to right):
- **Logo** (`public/assets/sslmLogo.png`) — application logo
- **SSLM** title with "SeaStar Library Manager" subtitle
- **Mode indicator** — Offline/Online badge
- **📊 Dashboard** button — scroll to dashboard (visible only when on dashboard)
- **🏠 Home** button — return to welcome screen
- **⚙️ Settings** button — open settings dialog
- **ℹ️ About** button — opens About modal (version from `sslm.iss`, contact email)
- **⏻ Quit** button — confirmation dialog → `POST /api/quit` → graceful server shutdown

### Version Reading (`readAppVersion()` in server.js)

The canonical version is defined in `installer/sslm.iss` as `#define AppVersion "x.x.x"`.
`server.js` reads this at startup via `readAppVersion()` and exposes it through `/api/config`.
Falls back to `package.json` version if the `.iss` file is not readable.
The frontend displays the version in the About dialog (`app.config.version`).

### Application Assets (`public/assets/`)

| File | Used for |
|------|---------|
| `sslm.png` | Welcome screen logo (160×160, large version) |
| `sslmLogo.png` | Header bar + browser favicon + installer small image |
| `astroNoobLogo.png` | About dialog (personal/author logo) |
| `sslm.ico` | Windows exe icon (embedded in exe + installed by installer) |

### Key Files

| File | Purpose |
|------|---------|
| `installer/sslm.iss` | Inno Setup script — source of truth for version + installer behaviour |
| `installer/output/` | Build output — gitignored, contains the distributable setup exe |
| `dist/sslm.exe` | Intermediate pkg build — gitignored |
| `server.js` (top) | `isPackaged` flag + APPDATA config logic + browser auto-open + `readAppVersion()` |
| `package.json` → `pkg` section | Declares target (node20-win-x64), bundled assets, and `--icon` flag |
| `notes/HOW_TO_RELEASE.md` | Local-only release checklist (gitignored) |

### Updating the Version
1. Update `#define AppVersion` in `installer/sslm.iss` (this is the source of truth)
2. Optionally bump `"version"` in `package.json` to keep them in sync
3. Run `npm run build` then recompile the `.iss` script

### Publishing a Release to GitHub
See `notes/HOW_TO_RELEASE.md` for the full step-by-step checklist. Summary:
1. `npm run build` → produces `dist/sslm.exe`
2. Compile `sslm.iss` in Inno Setup → produces `installer/output/SSLM-Setup-vX.X.X.exe`
3. Commit and push source code
4. `gh release create vX.X.X "installer/output/SSLM-Setup-vX.X.X.exe" --title "SSLM vX.X.X" --notes "..." --prerelease`
- Requires `gh auth login` on first use
- Run as a **single line** in CMD/PowerShell (no `\` line continuation)

## Development Notes

### Implementation Priority
1. **First deliverable**: Web-based application with initial setup workflow + Dashboard
   - Local web server setup (offline capable)
   - Mode selection interface (import vs. local copy)
   - Device connection (removable drive + network path option)
   - Import strategy selection (full copy vs. incremental)
   - File import with real-time progress display
   - Interactive dashboard with collection statistics
   - Online/offline mode toggle
2. **Future features**: To be defined after dashboard completion

### Technical Considerations

**Application Architecture**:
- Local web server runs on user's machine (e.g., http://localhost:5000)
- No internet required for core functionality
- **Offline Mode** (default): All features work without internet
- **Online Mode** (optional): Additional features when internet is available
  - Could include: online catalogs, object information lookup, etc.
  - User should be able to toggle between modes

**Device Access**:
- Primary: Removable drive detection (E:\, F:\, G:\, etc.)
- Secondary: Network path support (`\\seestar`)
- Validate `/MyWorks` directory exists before operations

**File Operations**:
- File paths use backslashes on Windows
- Object names may contain spaces (e.g., "Large Magellanic Cloud")
- Handle directory name variations (_mosaic, numbered variants like "IC 2602 37")
- Timestamps use 24-hour format
- Sub-frame counts can vary significantly (from 3 to 484+ frames)
- Storage requirement: Up to 50GB for full SeeStar content
- **Incremental copy**: Compare file modification dates/sizes to detect changes

**Safety**:
- **Never write to or modify files on the SeeStar device**
- All operations read-only on source, write to local destination only
- Validate paths before copy operations to prevent accidental overwrites

## Implemented Features

### Import Functionality (Phase 2 Complete)

#### 5-Step Import Wizard
The import wizard guides users through the process of importing files from a connected SeeStar device to local storage.

**Step 1: Device Detection & Selection**
- **Automatic Drive Detection**: Scans drives C: through Z: for SeeStar devices
- **MyWorks Directory Check**: Only displays drives that contain the configured SeeStar directory (MyWorks)
- **Network Path Support**: Includes network path option (`\\seestar\MyWorks`)
- **Configurable Directory Name**: SeeStar directory name is configurable in settings.json (`seestar.directoryName`)
- **Device Filtering**: Shows only valid SeeStar sources (drives with MyWorks + network path)
- **Visual Feedback**: Device cards with hover effects and selection states
- **Proceed Button**: Appears on right side when device is selected

**Step 2: Import Strategy Selection**
- **Full Copy**: Copies all files from source (for fresh imports)
  - Copies every file regardless of destination state
  - Suitable for initial imports or when starting fresh
- **Incremental Copy**: Copies only new or modified files (for updates)
  - Compares file size and modification time
  - Skips files that already exist and are up-to-date
  - Suitable for updating existing repositories
- **Strategy Cards**: Visual selection with hover effects and descriptions
- **Default Strategy**: Pre-selects based on user preference in config

**Step 3: Destination Selection**
- **Folder Browser**: Reuses existing folder browser component
- **Drive Selection**: Shows available drives with space information
- **Directory Navigation**: Browse subdirectories with up button
- **Create New Folder**: Button to create new directories on-the-fly
  - Modal dialog for folder name input
  - Validation to prevent invalid names
  - Automatic refresh after creation
- **Space Validation**: Real-time display of available vs required space
- **Favorites Integration**: Quick access to favorite folders

**Step 4: Confirmation Summary**
- **Source Information**: Selected device and path
- **Strategy Display**: Chosen import strategy (Full or Incremental)
- **Destination Path**: Where files will be copied
- **Space Requirements**: Required space vs available space
- **Estimated File Count**: Preliminary scan results
- **Start Import Button**: Initiates the import operation

**Step 5: Progress Display**
- **Real-Time Progress Bar**: Visual progress indicator (0-100%)
- **Current File Display**: Shows which file is currently being copied
- **File Statistics**:
  - Files copied / total files (count and percentage)
  - Files skipped (for incremental imports)
- **Byte Statistics**:
  - Bytes copied / total bytes (count and percentage)
  - Formatted display (MB, GB)
- **Performance Metrics**:
  - Transfer speed (calculated with moving average)
  - Time remaining (ETA based on current speed)
  - Elapsed time
- **Cancel Button**: Ability to stop import mid-operation
- **Completion Message**: Shows summary statistics when finished
- **Post-Import Actions**:
  - Saves paths to config for future reference
  - Analyzes imported directory
  - Transitions to dashboard with imported data

#### Backend Services

**ImportService** ([src/services/importService.js](src/services/importService.js))
- **Device Detection**: Scans Windows drives and network paths for SeeStar devices
  - Configurable directory name from settings.json
  - Only returns devices with valid SeeStar directory
- **File Scanning**: Recursively enumerates all files in source directory
  - `scanDirectory(dirPath, basePath, destinationPath)` - Scans files and constructs paths
  - Now accepts optional `destinationPath` parameter for validation scenarios
  - Falls back to `currentOperation.destinationPath` during active imports
- **Copy Strategies**:
  - Full Copy: Always copies all files
  - Incremental Copy: Compares file stats (size, mtime) to skip unchanged files
  - Pre-filters files before calculating totals for accurate progress display
- **Stream-Based Copying**: Uses Node.js streams for memory-efficient file copying
  - Handles large files (50GB+) without memory issues
  - Built-in backpressure handling
- **Progress Tracking**:
  - Tracks files copied, bytes copied, current file
  - Calculates transfer speed using 5-second moving average
  - Calculates ETA based on bytes remaining and current speed
  - Throttled Socket.IO emission (max every 500ms)
  - Shows accurate differential totals for incremental copies
- **Transfer Validation**: `validateTransfer(sourcePath, destinationPath, socketId, operationId)`
  - Verifies all source files exist in destination with correct size
  - Real-time progress updates via Socket.IO
  - Returns validation results with mismatch details
- **Cancellation Support**: Can stop import mid-operation safely
- **Error Handling**: Continues on individual file errors, reports at end
- **Debug Logging**: Detailed incremental copy decision logging ([COPY]/[SKIP] with reasons)
- **Socket.IO Events**:
  - `import:progress` - Regular progress updates during copy
  - `import:complete` - Emitted when all files copied successfully
  - `import:error` - Emitted if fatal error occurs
  - `import:cancelled` - Emitted if user cancels operation
  - `validate:progress` - Validation progress updates
  - `validate:complete` - Validation finished with results
  - `validate:error` - Validation error

**DiskSpaceValidator** ([src/utils/diskSpaceValidator.js](src/utils/diskSpaceValidator.js))
- **Strategy-Aware Space Calculation**:
  - Full Copy: Recursively calculates total size of all source files
  - Incremental Copy: Calculates size only for files that need copying (uses `shouldCopyFile` logic)
- **Available Space Check**: Uses Windows `wmic` command to get free space on destination drive
- **Safety Buffer**: Applies 10% buffer to required space to prevent edge cases
- **Formatted Output**: Converts bytes to human-readable format (KB, MB, GB, TB)
- **Validation Result**: Returns hasEnoughSpace boolean with detailed metrics
- **Methods**:
  - `hasEnoughSpace(sourcePath, destinationPath, strategy, buffer)` - Main validation method
  - `getIncrementalRequiredSpace(sourcePath, destinationPath)` - Calculates differential size
  - `shouldCopyFile(sourceFile, destFile, sourceStats)` - Determines if file needs copying

#### API Endpoints

**Import Operations**
- `GET /api/import/detect-seestar` - Detect SeeStar devices (removable and network)
  - Returns array of devices with MyWorks directory
  - Filters out devices without valid SeeStar directory
- `POST /api/import/validate-space` - Validate disk space before import
  - Body: `{sourcePath, destinationPath}`
  - Returns space availability and formatted metrics
- `POST /api/import/start` - Start import operation
  - Body: `{sourcePath, destinationPath, strategy, socketId}`
  - Returns operation ID immediately, progress via Socket.IO
- `POST /api/import/cancel` - Cancel ongoing import operation
  - Stops file copying, emits cancellation event

**Directory Management**
- `POST /api/browse/create-directory` - Create new directory
  - Body: `{parentPath, folderName}`
  - Returns new directory path on success

#### Configuration

**Settings** ([config/settings.json](config/settings.json))
```json
{
  "seestar": {
    "directoryName": "MyWorks"
  },
  "paths": {
    "lastSourcePath": "",
    "lastDestinationPath": ""
  },
  "preferences": {
    "defaultImportStrategy": "incremental"
  }
}
```

- **seestar.directoryName**: Configurable directory name for SeeStar devices (default: "MyWorks")
- **paths.lastSourcePath**: Remembers last source for future imports
- **paths.lastDestinationPath**: Remembers last destination for future imports
- **preferences.defaultImportStrategy**: Default import strategy ("full" or "incremental")

#### Safety Features

**Read-Only Source Operations**
- All import operations are read-only on source device
- Never modifies or deletes files on SeeStar device
- Copies files to local destination only

**Disk Space Validation**
- Validates sufficient space before starting import
- Applies 10% safety buffer to prevent disk full errors
- Shows clear error message if insufficient space

**Error Recovery**
- Continues copying on individual file errors
- Reports all errors at completion
- Skips inaccessible files without stopping operation

**Cancellation**
- Clean cancellation support during import
- Stops immediately when requested
- Reports progress at cancellation point
- No partial/corrupted files

#### Import Completion & Validation

**Post-Import Completion UI**
- **Done Button**: Appears when import reaches 100% completion
  - Hidden during active import, visible only at completion
  - Prevents user from feeling stuck on progress screen
  - Opens import complete modal with validation options
- **Import Complete Modal**: Shows import summary and next steps
  - Files copied count (with skipped count for incremental)
  - Total data transferred (formatted)
  - Import duration
  - Error count (if any failures occurred)
  - Two action options: Skip to Dashboard or Validate Transfer

**Transfer Validation** ([src/services/importService.js](src/services/importService.js))
- **Purpose**: Verifies all source files exist in destination with correct size
- **Validation Strategy**: Compares ALL files in source against destination
  - Independent of import type (full or incremental)
  - Validates complete directory integrity, not just transferred files
  - Example: After incremental copy of 100 files, validates all 1,250 source files exist in destination
- **Real-Time Progress Display**:
  - Progress bar (0-100%)
  - Files validated count (e.g., "1,234 / 1,250")
  - Issues found count (color-coded: green if 0, red if issues)
  - Current status message ("Scanning files...", "Validating files...")
- **Validation Logic**:
  - Scans all files in source directory
  - For each file, checks if it exists in destination
  - Compares file sizes (source vs destination)
  - Reports missing files or size mismatches
- **Results Modal**:
  - Validation successful: Shows checkmark, files validated, duration
  - Validation failed: Shows warning, lists issues (up to 50), suggests re-import
  - "View Dashboard" button to proceed
- **Socket.IO Events**:
  - `validate:progress` - Real-time progress updates
  - `validate:complete` - Validation finished with results
  - `validate:error` - Fatal validation error
- **Bug Fix**: `scanDirectory()` method now accepts optional `destinationPath` parameter
  - Previously used `this.currentOperation?.destinationPath` which was null after import
  - Now explicitly passes destination path during validation
  - Ensures correct file path construction for validation

**Modal System Improvements**
- **Clean Modal Footer**: `app.showModal()` now clears footer before displaying
  - Removes leftover buttons from previous modals
  - Prevents "Create New Folder" and other buttons appearing in wrong modals
  - Each modal shows only intended buttons (Cancel + primary action)
- **Modal Width**: Increased from 500px to 700px for better content visibility
- **Dashboard Reference Fix**: Changed `app.dashboard` to `window.dashboard`
  - Dashboard exposes itself as `window.dashboard` (global)
  - Fixed "Cannot read properties of undefined (reading 'displayResults')" error

**Strategy-Aware Space Validation**
- **Full Copy**: Calculates total size of all source files
- **Incremental Copy**: Calculates only size of files that need copying
  - Uses `shouldCopyFile()` logic to determine which files differ
  - Shows accurate differential size (e.g., 9GB instead of 22GB full size)
  - Applies to both validation step and progress display
- **Implementation**: `DiskSpaceValidator.hasEnoughSpace()` accepts strategy parameter

**Incremental Copy Debugging**
- Added detailed console logging for troubleshooting
- Logs each file decision: [COPY] or [SKIP] with reason
- Shows size differences, modification time comparisons
- Summary statistics of files to copy vs skip
- Helps identify incorrect skipping behavior

### Merge Functionality (Phase 3 - COMPLETE)

#### Overview

The merge feature allows users to combine multiple SeeStar library copies into a single consolidated library. This is useful when managing multiple backups or combining collections from different sources.

**Use Cases:**
- Multiple library copies on different drives (some with overlapping content, some unique)
- Combining backups from different time periods
- Consolidating after importing from multiple devices
- Creating a master library from partial copies

**Key Design Decisions:**
- **Destination Strategy**: Create new merged library (doesn't modify any existing libraries)
- **Duplicate Detection**: Files with same relative path are considered duplicates
- **Conflict Resolution**: Keep newer version based on file modification date (mtime)
- **Session Handling**: Keep all stacked images, even from same imaging sessions
- **Safety**: All source libraries are read-only (never modified)

#### 6-Step Merge Wizard

**Step 1: Source Library Selection**
- Multi-select folder browser (minimum 2 libraries required)
- Shows selected libraries list with remove buttons
- "Add Library" button to add more sources
- Validates at least 2 sources before proceeding

**Step 2: Destination Selection**
- Folder browser for destination directory
- "Create New Folder" capability for new merged library
- Real-time disk space validation
- Shows available vs required space

**Step 3: Analysis & Preview**
- Analyzes all source libraries to build merge plan
- **Scans destination directory** for existing files (if destination already has content)
- Displays statistics in tabular format:
  - Total files from each source library
  - Duplicates detected (same relative path across sources)
  - Conflicts found (files that exist in multiple sources with differences)
  - **Files already in destination** (will be skipped if same size/mtime)
  - Final file count after deduplication
  - **Actual files to copy** (excluding files already in destination)
  - Space requirements vs available space
- Shows conflict resolution preview (first 10 examples)
- Conflict table shows: File Path, Source 1 info, Source 2 info, Resolution (which wins)

**Step 4: Confirmation**
- Tabular display with key statistics
- Source libraries count and paths (with full paths)
- Destination path
- Merge statistics table:
  - Total files from all sources
  - Duplicates removed
  - Final file count
  - **Files already in destination** (shown if > 0, with size)
  - **Files to copy** (actual work to be done)
  - Total size to copy
- Disk space validation table (required vs available)
- Conflict resolution strategy table
- "Start Merge" button

**Step 5: Merge Progress**
- Real-time progress display:
  - Overall progress bar (0-100%)
  - Current file being copied (with source library name)
  - File statistics (files copied / total)
  - Byte statistics (bytes copied / total, formatted)
  - Transfer speed (MB/s)
  - Time remaining (ETA)
  - Elapsed time
- Per-source progress breakdown (visual bars for each source)
- Cancel button for stopping merge
- Completion message with "Done" and "Validate Transfer" buttons

**Step 6: Validation (Optional)**
- Post-merge integrity verification
- Progress bar (files validated / total)
- Issues found count (color-coded)
- Results modal:
  - Success: Shows checkmark, files validated, duration
  - Failure: Shows warning, lists issues, suggests re-merge
- "View Dashboard" button to explore merged library

#### Backend Implementation

**MergeService** (NEW: `src/services/mergeService.js`)

Key methods:
- `analyzeSources(sourcePaths, destinationPath)` - Analyze libraries and build merge plan
- `buildFileInventory(sourcePaths)` - Build unified file inventory from all sources
- `resolveConflicts(inventory)` - Detect duplicates and resolve conflicts
- `executeMerge(sourcePaths, destinationPath, mergePlan, socketId, operationId)` - Execute merge with progress tracking
- `validateMerge(destinationPath, mergePlan, socketId, operationId)` - Verify merged library integrity
- `cancelMerge()` - Cancel ongoing merge operation

**File Inventory Structure:**

```javascript
// Map: relativePath → array of candidates from different sources
Map {
  "NGC 6729/Stacked_210_NGC 6729_30.0s_IRCUT_20250822-231258.fit" => [
    {
      sourcePath: "H:/Library1/NGC 6729/Stacked_210...",
      sourceLibrary: "H:/Library1",
      size: 10485760,
      mtime: Date("2025-08-20T22:45:00"),
      selected: false  // Older version
    },
    {
      sourcePath: "H:/Library2/NGC 6729/Stacked_210...",
      sourceLibrary: "H:/Library2",
      size: 10485760,
      mtime: Date("2025-08-22T23:30:00"),
      selected: true  // Newer version - wins
    }
  ]
}
```

**Conflict Resolution Logic:**
- For each relative path with multiple candidates:
  - Compare modification times (mtime)
  - Select file with newest mtime
  - Mark as `selected: true`
  - Track resolution decision for reporting

**Merge Plan Structure:**

```javascript
{
  totalFiles: 1250,
  totalBytes: 22000000000,
  sourceStats: {
    "H:/Library1": { files: 600, bytes: 10000000000 },
    "H:/Library2": { files: 750, bytes: 13000000000 }
  },
  duplicates: {
    count: 100,
    examples: [...]  // First 10 for preview
  },
  conflicts: {
    count: 100,
    resolutions: [
      {
        relativePath: "NGC 6729/Stacked_210...",
        winningSource: "H:/Library2",
        reason: "newer (2025-08-22 vs 2025-08-20)"
      }
    ]
  },
  uniqueFiles: 1150,  // Final count after deduplication
  filesToCopy: [...]  // Array of selected files
}
```

**DiskSpaceValidator Enhancement** (MODIFY: `src/utils/diskSpaceValidator.js`)
- New method: `getMergeRequiredSpace(sourcePaths, destinationPath)`
- Calculates total size of unique files after conflict resolution
- Returns deduplicated size estimate (not sum of all sources)
- Applies 10% safety buffer

#### API Endpoints

**Merge Operations:**
- `POST /api/merge/analyze` - Analyze multiple source libraries
  - Body: `{sourcePaths: [...], destinationPath: "..."}`
  - Returns merge plan with statistics
- `POST /api/merge/validate-space` - Validate disk space for merge
  - Body: `{sourcePaths: [...], destinationPath: "..."}`
  - Returns space validation result
- `POST /api/merge/start` - Start merge operation
  - Body: `{sourcePaths: [...], destinationPath: "...", mergePlan: {...}, socketId: "..."}`
  - Returns operation ID, progress via Socket.IO
- `POST /api/merge/cancel` - Cancel ongoing merge operation
- `POST /api/merge/validate` - Validate merged library integrity
  - Body: `{destinationPath: "...", mergePlan: {...}, socketId: "..."}`

**Socket.IO Events:**
- `merge:progress` - Real-time progress updates during merge
- `merge:complete` - Merge operation completed
- `merge:error` - Fatal error during merge
- `merge:cancelled` - User cancelled merge
- `validate:progress` - Validation progress (reused from import)
- `validate:complete` - Validation finished (reused from import)
- `validate:error` - Validation error (reused from import)

#### Frontend Implementation

**MergeWizard** (NEW: `public/js/mergeWizard.js`)
- 6-step wizard UI class
- Multi-source selection component
- Conflict preview table
- Per-source progress breakdown
- Socket.IO event handlers for real-time updates

**UI Updates:**
- `public/index.html` - Add merge wizard screen and merge mode card
- `public/js/modeSelection.js` - Add merge mode handler

#### Reused Components

**From ImportService:**
- `scanDirectory()` - Recursive file enumeration
- `copyFileWithProgress()` - Stream-based copying
- Progress tracking patterns (speed, ETA, throttling)
- Socket.IO event emission
- Cancellation support
- Error recovery

**From Import Wizard:**
- Step indicator pattern
- Folder browser component
- Progress display layout
- Validation flow
- Modal dialogs

#### Safety Features

1. **Read-Only Sources**: All source libraries never modified (only read)
2. **New Destination**: Creates new library (doesn't overwrite)
3. **Disk Space Validation**: Validates before merge starts
4. **Pre-Merge Preview**: Shows what will happen before executing
5. **Cancellation Support**: Can stop merge safely at any time
6. **Error Recovery**: Continues on file errors, reports at end
7. **Post-Merge Validation**: Verifies all files copied correctly
8. **Conflict Transparency**: Shows which version kept and why

#### Expected Performance

Estimated merge times (SSD, local drives):

| Library Size | File Count | Estimated Time |
|--------------|-----------|----------------|
| 5 GB (2 libs) | 500 files | 1-2 minutes |
| 20 GB (3 libs) | 2000 files | 4-6 minutes |
| 50 GB (4 libs) | 5000 files | 10-15 minutes |

Network drives will be 3-5x slower.

#### Files to Create/Modify

**New Files:**
1. `src/services/mergeService.js` - Core merge orchestration
2. `src/utils/mergeAnalyzer.js` - Helper utilities for statistics
3. `public/js/mergeWizard.js` - 6-step merge wizard UI
4. `tests/mergeService.test.js` - Unit tests
5. `documentation/MERGE_GUIDE.md` - User guide

**Modified Files:**
1. `server.js` - Add 5 merge API endpoints
2. `src/utils/diskSpaceValidator.js` - Add `getMergeRequiredSpace()`
3. `public/index.html` - Add merge wizard screen and mode card
4. `public/js/modeSelection.js` - Add merge mode handler
5. `public/css/styles.css` - Merge-specific styles

#### Implementation Timeline

**Sprint 1: Backend Foundation (3-4 days)**
- Create MergeService with core methods
- Implement file inventory building
- Implement conflict resolution
- Add API endpoints
- Write unit tests

**Sprint 2: Frontend UI (4-5 days)**
- Create MergeWizard class
- Implement all 6 steps
- Add merge mode to welcome screen
- Connect Socket.IO events
- Add CSS styling

**Sprint 3: Testing & Polish (2-3 days)**
- Manual testing with real data
- Edge case testing
- Performance testing
- Bug fixes
- Documentation

**Total Estimated Time:** 12-16 days

#### Completed Implementation (February 2026)

**Backend Complete:**
- ✅ `MergeService` class with all core methods implemented
- ✅ `getMergeRequiredSpace()` added to DiskSpaceValidator
- ✅ 5 merge API endpoints added to server.js
- ✅ Socket.IO events for real-time progress tracking
- ✅ Graceful server shutdown fix (Ctrl+C properly exits process)

**Frontend Complete:**
- ✅ `MergeWizard` class with all 6 steps
- ✅ Merge mode card added to welcome screen
- ✅ Merge wizard screen HTML structure
- ✅ `selectMergeMode()` method in modeSelection.js
- ✅ Folder browser interaction fixes (cursor and selection)
- ✅ Step 1 button layout improvements (compact design)
- ✅ Step progress indicator updates (visual state changes)
- ✅ Step 3 tabular display for merge plan preview
- ✅ Step 4 tabular display for confirmation screen
- ✅ Compact header design for better screen space
- ✅ CSS styling for merge statistics tables

**UI Improvements:**
- **Tabular Displays**: Step 3 (Analysis Preview) and Step 4 (Confirmation) use clean table layouts
  - Proper borders, backgrounds, and spacing
  - Numbers formatted with thousand separators
  - Highlighted rows for important metrics
  - Consistent styling across all merge screens
- **Compact Headers**: Reduced header heights to ensure buttons visible without scrolling
  - App header: 0.75rem padding, 1.35rem font size
  - Merge wizard header: 0.75rem padding, 1.25rem title
  - Step indicators: 32px circles, 0.8rem labels
  - Step indicators update properly with completed/active states
- **Button Organization**: Clean separation of controls
  - "Add Library" button in top right
  - "Remove" buttons on left side of each item
  - "Next" button in bottom right corner
  - Proper flexbox layouts for positioning

**Bug Fixes:**
- Fixed folder browser cursor not changing to pointer on hover
- Fixed folder selection not working (onclick → event listeners)
- Fixed step progress indicator not updating (scoped query selector)
- Fixed server not stopping with Ctrl+C (graceful shutdown with timeout)
- Added completed step visual indicator (green with checkmark)

**Recent Improvements (2026-02-15):**
- ✅ **Real-Time Analysis Progress**: Step 3 now shows live scanning progress
  - Displays which library is being scanned (e.g., "Scanning Library 2 of 4")
  - Shows full path of current library being scanned
  - Displays file count found in each library with checkmark
  - Shows status when scanning destination directory
  - Added `handleAnalyzeProgress()` Socket.IO event handler
  - Updated Step 3 UI with `analyzeStatusMessage` and `analyzeProgressDetails` elements
  - Modified analyze request to include socketId for real-time updates
- ✅ **Enhanced Dashboard Navigation**:
  - Added path normalization in `skipToAnalysisDashboard()` (ensures Windows backslashes)
  - Added animated loading donut during dashboard analysis
  - Fixed cross-wizard event handling (import wizard no longer interferes with merge validation)
  - Proper screen activation checks using CSS class instead of inline styles
- ✅ **Streamlined Workflow**:
  - Removed all intermediate modals (merge completion, validation results)
  - Automatic progression: Merge → Validation → Dashboard
  - Auto-skip to validation when no files need copying (Step 3 → Step 6)
  - Added Home button (🏠) in header for easy navigation back to welcome screen
- ✅ **UI/UX Improvements**:
  - All completion screens auto-proceed with visual feedback
  - Brief transition messages between stages
  - Loading donut animation during dashboard analysis
  - Clean, uninterrupted workflow from start to finish

**Testing Status:**
- ✅ Successfully tested with 2 identical libraries (proper duplicate detection)
- ✅ Successfully tested with real library copies containing differences
- ✅ Real-time analysis progress display working correctly
- ✅ Dashboard navigation and loading working properly
- ✅ Auto-skip to validation when no files need copying
- ✅ Complete end-to-end merge workflow validated
- ✅ Home button navigation tested across all screens

### Dashboard Features

#### Main Dashboard View
- **Summary Cards**: Display key statistics (total objects, with/without sub-frames, total size, total files, empty directories)
- **Sidebar Navigation**: Smooth scrolling navigation to different dashboard sections
- **File Type Breakdown**: Statistics for .FIT files, JPG files, thumbnails, and MP4 videos
- **Catalog Breakdown**: Visual cards showing object counts by catalog (Messier, NGC, IC, Sharpless, etc.)
  - Clickable catalog cards with hover effects
  - Each catalog card displays icon, count, and catalog name
- **Empty Directory Detection**: Identifies and lists empty directories with one-click cleanup
- **Sub-Frame Cleanup**: Identifies JPG/thumbnail files in _sub directories that can be safely removed
  - Global cleanup option (clean all objects at once)
  - Individual cleanup option (clean specific objects)
  - Space savings preview
- **Objects Table**: Comprehensive table showing all objects with:
  - Object name (clickable to view details)
  - Catalog type
  - Sub-frame presence indicator
  - Sub-frame file breakdown (.fit vs other)
  - Integration time per object
  - Total files and size
  - Individual cleanup buttons
  - Search functionality to filter by name or catalog

#### Catalog Detail View
- **Clickable Catalogs**: Click any catalog card to view catalog-specific page
- **Catalog Statistics**: Shows summary stats for selected catalog only
  - Total objects in catalog
  - Objects with/without sub-frames
  - Total size and file count
  - Total integration time
- **Date Range**: First and latest capture dates for the catalog
- **Filtered Objects Table**: Shows only objects from selected catalog
- **Back Navigation**: Return to main dashboard with back button

#### Object Detail View
- **Clickable Objects**: Click any object name in tables to view detailed page
- **Visual Hover Effects**: Object names highlight on hover to indicate they're clickable
- **Comprehensive Metadata**:
  - Stacking counts (number of sub-frames combined in each image)
  - Exposure times used
  - Filters used (IRCUT, LP, etc.)
  - Integration time per object
- **Exposure Breakdown**:
  - Main folder: Count of stacked images by exposure time
  - Sub-frames folder: Count of light frames by exposure time
  - Visual cards showing exposure/count pairs
- **Stacking Counts Display**: Shows total frames across all sessions + per-session breakdown
  - Format: `751 total (298, 453 per session)`
  - Derived from parsed sessions (uses max stack count per night, not raw file counts)
- **Imaging Sessions Table**:
  - Date and time of each imaging session (date is a clickable link)
  - Number of stacked frames (final count per night, not intermediate)
  - Exposure time
  - Filter used
  - Total integration time per session
  - Actions column with a delete button (🗑️) per row
  - Intermediate stacking snapshots from the same night are merged into one session (keeping the highest frame count)
- **Session Detail View** (new screen: `sessionDetailScreen`):
  - Opened by clicking the date link in the Imaging Sessions table
  - Shows all stacked files from that session (main folder, all file types, expanded by default)
  - Shows all sub-frame light frames for that session (matched by date + exposure + filter)
  - Session summary header cards (date, time, frames, exposure, filter, integration)
  - Delete Session button at the top
  - Back button returns to Object Detail without re-rendering
- **Delete Session**:
  - Available from the session detail screen or via the 🗑️ button in the sessions table row
  - Confirmation modal shows file count before proceeding
  - Calls `POST /api/cleanup/session` to delete all matching files (main + sub folders)
  - On success: refreshes dashboard data and re-renders the object detail
- **File Lists**:
  - Main folder files with capture dates
  - Sub-frames folder files with capture dates
  - Grouped by file type (.fit, .jpg, thumbnails, videos)
  - Expandable sections for each file type (expanded by default in Session Detail View)
- **Individual Cleanup**: Button to clean sub-frame directory for this object
  - Button disappears immediately after successful cleanup
  - Object detail view re-renders automatically after the cleanup refresh

### Folder Selection & Favorites

#### Favorites System
- **Save Favorites**: Add frequently used folders to favorites list
- **Favorite Display**: Shows list of favorite folders with:
  - Folder icon
  - Folder name
  - Full path (truncated if too long)
  - Remove button (✕) to delete from favorites
- **Quick Access**: Click any favorite to instantly select it
- **Visual Feedback**: Selected favorite highlights with border color change
- **Persistence**: Favorites saved to config/settings.json
- **API Endpoints**:
  - GET /api/favorites - Retrieve all favorites
  - POST /api/favorites/add - Add new favorite
  - POST /api/favorites/remove - Remove favorite

#### Folder Browser
- **Drive Detection**: Automatically detects available drives (C:\, D:\, E:\, etc.)
- **Common Paths**: Quick access to common directories (Desktop, Documents, etc.)
- **Directory Navigation**: Browse subdirectories with up button
- **Modal Interface**: Clean modal dialog for folder selection
- **Path Display**: Shows current path while browsing

### Cleanup Operations

#### Empty Directory Cleanup
- **Detection**: Automatically identifies empty directories during analysis
- **Confirmation Dialog**: Shows count of directories to be deleted
- **Batch Deletion**: Deletes all empty directories at once
- **Progress Indicator**: Shows loading state during operation
- **Result Report**: Shows success/failure count after operation
- **Dashboard Refresh**: Automatically refreshes after cleanup

#### Sub-Frame Cleanup
- **Detection**: Identifies non-.fit files in _sub directories
- **Space Calculation**: Shows estimated space to be freed
- **Safety**: Only deletes JPG and thumbnail files, never touches .fit files
- **Two Modes**:
  - Global: Clean all sub-frame directories at once
  - Individual: Clean specific object's sub-frame directory
- **Confirmation Dialog**: Shows file count and affected objects
- **Result Report**: Shows files deleted, space freed, success/failure counts
- **Dashboard Refresh**: Automatically refreshes after cleanup

### Data Analysis

#### File Analyzer Service
- **Directory Scanning**: Recursively scans SeeStar directory structure
- **Object Detection**: Identifies object directories and their sub-frame pairs
- **Catalog Parsing**: Extracts catalog information from directory names
- **File Counting**: Counts files by type (.fit, .jpg, .mp4, thumbnails)
- **Size Calculation**: Calculates total storage usage
- **Date Range Extraction**: Finds oldest and newest captures from filenames
- **Integration Time Calculation**: Computes total integration time from stacking counts and exposure times
- **Light Frame Counting**: Counts individual light frames in sub-frame directories
- **Metadata Extraction**: Parses filenames to extract:
  - Stacking counts
  - Exposure times
  - Filters used
  - Timestamps
  - Object names

### User Interface

#### Visual Design
- **Dark Theme**: Easy on the eyes for night-time use
- **Responsive Layout**: Adapts to different screen sizes
- **Color-Coded Elements**: Different colors for different data types
- **Icon Usage**: Emojis used for visual identification
- **Smooth Animations**: Transitions for hover effects and navigation
- **Loading Indicators**: Spinner and loading text during operations
- **Modal Dialogs**: Clean confirmation and result displays

#### Navigation
- **Screen Switching**: Smooth transitions between screens
- **Back Buttons**: Clear navigation back to previous views
- **Smooth Scrolling**: Animated scrolling to dashboard sections
- **Sticky Sidebar**: Navigation sidebar remains visible while scrolling

#### Interactions
- **Hover Effects**: Visual feedback on clickable elements
- **Search Filtering**: Real-time filtering of objects table
- **Expandable Sections**: Click to expand/collapse file lists
- **Button States**: Disabled states for unavailable actions
- **Visual Feedback**: Border and background color changes on selection

### Data Persistence

#### Configuration Management
- **Settings File**: config/settings.json stores user preferences
- **Favorites Storage**: Favorites list persisted across sessions
- **Server Configuration**: Port, host, and mode settings
- **Path Memory**: Last used source and destination paths (for future incremental imports)

### API Endpoints

#### Analysis
- GET /api/analyze?path={path} - Analyze directory and return statistics

#### Favorites
- GET /api/favorites - Get all favorites
- POST /api/favorites/add - Add favorite (body: {path, name})
- POST /api/favorites/remove - Remove favorite (body: {path})

#### Cleanup
- POST /api/cleanup/empty-directories - Delete empty directories (body: {directories})
- POST /api/cleanup/subframe-directories - Clean sub-frame directories (body: {objects})
- GET /api/cleanup/subframe-info?path={path} - Get sub-frame cleanup information

#### Import Operations
- GET /api/import/detect-seestar - Detect SeeStar devices (returns devices with MyWorks directory)
- POST /api/import/validate-space - Validate disk space (body: {sourcePath, destinationPath, strategy})
- POST /api/import/start - Start import operation (body: {sourcePath, destinationPath, strategy, socketId})
- POST /api/import/cancel - Cancel ongoing import operation
- POST /api/import/validate - Validate transfer integrity (body: {sourcePath, destinationPath, socketId})

#### Directory Browsing
- GET /api/browse/drives - Get available drives and common paths
- GET /api/browse/directory?path={path} - Get directory contents
- GET /api/browse/validate?path={path}&checkMyWorks={bool} - Validate path
- POST /api/browse/create-directory - Create new directory (body: {parentPath, folderName})

### Known Patterns & Parsing

#### Filename Parsing
- **Stacked Images**: `Stacked_{count}_{object}_{exposure}s_{filter}_{timestamp}.fit`
- **DSO Stacked Images**: `DSO_Stacked_{count}_{object}_{exposure}s_{timestamp}.fit`
- **Light Frames**: `Light_{object}_{exposure}s_{filter}_{timestamp}.fit`
- **Timestamp Format**: YYYYMMDD-HHMMSS (e.g., 20250822-231258)
- **Exposure Format**: Decimal seconds (e.g., 30.0s, 10.0s)
- **Filters**: IRCUT (IR Cut filter), LP (Light Pollution filter)

#### Directory Naming
- **Main Directory**: Object name (e.g., "NGC 6729", "M 42")
- **Sub-frame Directory**: Object name + "_sub" suffix (e.g., "NGC 6729_sub")
- **Mosaic Variant**: Object name + "_mosaic" suffix (e.g., "M 45_mosaic")
- **Special Characters**: Spaces, hyphens, and numbers in object names

## Recent Bug Fixes (2026-02-14)

### Directory Browser Error Fix
**Issue**: When selecting "Local Copy" mode and browsing for a folder, the application threw an error: "Cannot read properties of undefined (reading 'length')"

**Root Cause**: Property name mismatch between server and client
- Server API (`/api/browse/directory`) returned directory list as `directories` property
- Client code (`modeSelection.js`) expected the property to be named `items`
- When accessing `data.items.length`, the undefined `items` property caused the error

**Fix**: Updated `renderDirectoryContents()` in `modeSelection.js`
- Changed `data.items` references to `data.directories`
- Added defensive null check: `const directories = data.directories || []`
- Ensures graceful handling even if property is missing

**Files Modified**: 
- `public/js/modeSelection.js` (lines 409-417)

### Dashboard Card Layout Fix
**Issue**: Summary cards in the dashboard were wrapping to multiple rows instead of displaying in a single horizontal line

**Root Cause**: Grid layout using `repeat(auto-fit, minmax(200px, 1fr))` caused cards to wrap when viewport width was insufficient for all cards at minimum 200px width

**Fix**: Changed grid layout to fixed 6-column layout
- Changed from `repeat(auto-fit, minmax(200px, 1fr))` to `repeat(6, 1fr)`
- Reduced gap from `1.5rem` to `1rem` for more compact display
- All 6 summary cards now display in one horizontal row

**Files Modified**:
- `public/js/dashboard.js` (line 72)

### Object Detail Scroll Position Fix
**Issue**: When clicking an object to view its detail page, the page would load scrolled to the bottom instead of the top

**Root Cause**: The `showObjectDetail()` function switched screens but didn't reset scroll position

**Fix**: Added scroll to top after screen switch
- Added `window.scrollTo(0, 0)` after `app.showScreen('objectDetailScreen')`
- Users now land at the top of the detail page where the object header is visible

**Files Modified**:
- `public/js/dashboard.js` (lines 1082-1086)

### Imaging Session Grouping Fix
**Issue**: Imaging sessions table showed duplicate entries for files from the same session
- Example: 3 files captured on 1/2/2026 at 11:36 PM with 20s exposure and LP filter were displayed as 3 separate sessions instead of 1 grouped session

**Root Cause**: The `parseImagingSessions()` function created a new session entry for each stacked file without grouping by session parameters

**Fix**: Implemented session grouping using Map data structure
- Created unique session key combining: date + time + exposure + filter
- Sessions with identical parameters are now combined into single entries
- Stack counts are aggregated (e.g., 60+60+60 = 180 total frames)
- Added `fileCount` property to track how many files were combined

**Implementation Details**:
- Used `Map` to group sessions by unique key: `${dateStr}_${timeStr}_${exposure}_${filter}`
- When duplicate session found, adds to existing stack count instead of creating new entry
- Converts Map to array and sorts by datetime before returning
- Fixed regex pattern to correctly parse object names with spaces

**Files Modified**:
- `public/js/dashboard.js` (lines 1209-1261)

**Impact**: Imaging sessions now display accurately, showing the true number of distinct imaging sessions rather than the number of stacked files

## Recent Bug Fixes (2026-02-19)

### Stale Object Detail After Sub-Frame Cleanup
**Issue**: After cleaning up sub-frames from the object detail page, navigating to the sub-frames file list still showed the deleted JPG files.

**Root Cause**: `cleanupSingleObject()` called `refreshDashboard()` which updated `this.data` and re-rendered the main dashboard HTML, but the object detail screen was already rendered with stale data and was not refreshed.

**Fix**: Added a call to `showObjectDetail(object.name)` inside the post-refresh `setTimeout`, guarded by a check that the user is still on the object detail screen (`app.currentScreen === 'objectDetail'`).

**Files Modified**: `public/js/dashboard.js`

### Cleanup Button Not Disappearing After Cleanup
**Issue**: After sub-frame cleanup on the object detail page, the "Clean Up Sub-Frames" button remained visible until the full 2-second refresh cycle completed.

**Fix**: Added immediate DOM removal of the button on cleanup success, before the refresh timer fires.

**Files Modified**: `public/js/dashboard.js`

### Modal Cancel Button Non-Functional
**Issue**: The "Cancel" button in cleanup result modals did not close the modal. `cloneNode(true)` does not copy event listeners, so the cloned cancel button had no handler.

**Fix**: Rewrote `app.showModal()` to operate in two modes:
- **Single-button mode** (no `confirmCallback`): renders one close/Done button with a fresh `addEventListener`
- **Two-button mode** (with `confirmCallback`): renders Cancel + Confirm, both with fresh `addEventListener` calls

Also changed cleanup result dialogs from showing a non-functional Cancel to showing a "Done" button.

**Files Modified**: `public/js/app.js`

### Session Detail View & Delete Session (New Feature)
**Feature**: Clicking the date in the Imaging Sessions table opens a full-screen Session Detail View showing all files for that session. A delete button (🗑️) per row allows permanent deletion of all session files.

**Implementation**:
- `src/services/fileCleanup.js`: Added `deleteSessionFiles()` static method
- `server.js`: Added `POST /api/cleanup/session` endpoint
- `public/index.html`: Added `sessionDetailScreen` div with `.session-detail-content` container
- `public/js/dashboard.js`:
  - `parseImagingSessions()`: Added `rawDateStr`, `rawTimestamps` (Set), `files[]` fields per session
  - Sessions table HTML: clickable date links (`.session-date-link`), delete buttons (`.session-delete-btn`), Actions column
  - `renderObjectDetail()`: Event delegation for date clicks and delete clicks; stores `_currentSessionObj` and `_currentSessions`
  - New `_getSessionFiles(obj, session)`: returns `{ mainFiles, subFiles }` matched by timestamps and date+exposure+filter
  - New `showSessionDetail(sessionIdx)`: renders full-screen session view
  - New `deleteSession(sessionIdx)`: confirms and calls API, then refreshes
  - `renderFileList()`: Added `defaultOpen` parameter (session detail passes `true`)

### Sub-Frame Exposure Token Mismatch Fix
**Issue**: Sub-frame light frames showed 0 files in the session detail view. The exposure token `"20s"` (JS float) did not match `"20.0s"` in filenames — `"20.0s".includes("20s")` is `false`.

**Fix**: Changed `_getSessionFiles()` to use `session.exposure.toFixed(1) + 's'` for sub-frame file matching.

**Files Modified**: `public/js/dashboard.js`

### Stacking Counts Including JPG Files
**Issue**: The "Stacking Counts" metadata and imaging sessions table showed inflated or incorrect frame counts because `parseImagingSessions()` processed all files including `.jpg` and `_thn.jpg` versions of stacked images, tripling the apparent counts.

**Fix**:
- `parseImagingSessions()` now filters main folder files with `.endsWith('.fit')` before parsing
- `fileAnalyzer.js` `scanFolderFiles()` now only calls `extractStackingCount()` for `.fit` files

**Files Modified**: `public/js/dashboard.js`, `src/services/fileAnalyzer.js`

### Intermediate Stacking Results Shown as Separate Sessions
**Issue**: The SeeStar saves progressive stacking snapshots during a session (e.g., 74 frames at 09:09 PM, 453 frames at 11:48 PM on the same night). These appeared as two separate sessions instead of one.

**Root Cause**: Session key included time-of-day (`${dateStr}_${timeStr}_${exposure}_${filter}`), making each snapshot unique.

**Fix**: Changed session key to date-only (`${dateStr}_${exposure}_${filter}`). When multiple snapshots share a key, the **highest stack count** is kept (the final result) and the time updates to the latest snapshot. All snapshot timestamps are accumulated in `rawTimestamps` for reliable session file matching.

**Files Modified**: `public/js/dashboard.js`

### Stacking Counts Metadata Display
**Issue**: "Stacking Counts" showed a list of raw values (e.g., `74, 298, 453`) which was confusing — users expected a total.

**Fix**: Changed display to show both total and per-session breakdown: `751 total (298, 453 per session)`. Values are now derived from `parseImagingSessions()` rather than `obj.stackingCounts`, ensuring intermediate snapshots are excluded.

**Files Modified**: `public/js/dashboard.js`

## Recent Improvements (2026-02-19 — Session 2)

### Expurged Sub-Frame Mode (Import & Merge)

**Feature**: Both the Import Wizard and Merge Wizard now support a **Full / Expurged** mode for `_sub` directories.

- **Full** (default, unchecked): all files copied including JPGs and thumbnails from `_sub` directories
- **Expurged** (checkbox checked): only `.fit` light frames copied from `_sub` directories; all JPGs and thumbnails are skipped

**Detection logic**: a file is "subframe non-fit" when its relative path contains a parent directory ending with `_sub` **and** the file extension is not `.fit`.

**subframeMode values**: `'all'` (Full) | `'fit_only'` (Expurged)

**Files modified**:
- `src/services/importService.js` — added `isSubframeNonFit()`, filters files during scan when `fit_only`
- `src/services/mergeService.js` — added `isSubframeNonFit()`, filters inventory during analysis when `fit_only`
- `src/utils/diskSpaceValidator.js` — added `static isSubframeNonFit()`, all space calculation methods honour `subframeMode`
- `server.js` — all relevant endpoints extract and forward `subframeMode`
- `public/js/importWizard.js` — checkbox UI in Step 2, `subframeMode` passed to all API calls
- `public/js/mergeWizard.js` — checkbox UI in Step 2, `subframeMode` passed to analyze call

### Space Savings Display (Import Wizard Step 3)

When Expurged mode is selected, the Disk Space Validation screen shows how much space is saved compared to a Full import, e.g.:

> 🔬 Expurged mode saves **4.2 GB** (full import would require 22.1 GB)

Implemented by making a second `/api/import/validate-space` call with `subframeMode: 'all'` and computing the difference client-side.

**Files modified**: `public/js/importWizard.js`

### Expurged-Aware Transfer Validation

**Issue**: After an Expurged import, the transfer validation flagged all intentionally-skipped JPG/thumbnail files in `_sub` directories as missing, generating thousands of false errors.

**Fix**: `validateTransfer()` now accepts `subframeMode` and filters out `isSubframeNonFit` files before validation when mode is `fit_only`. The frontend passes `subframeMode` to `/api/import/validate`.

**Files modified**: `src/services/importService.js`, `server.js`, `public/js/importWizard.js`

### Import Progress Screen Improvements

**Indeterminate progress bar during preparation**:
- Replaced static "Preparing import..." text with a pulsing CSS animation bar (`@keyframes importPulse`)
- Automatically switches to the real percentage bar when the first `import:progress` Socket.IO event arrives
- Stats rows (files, data, speed, ETA) are hidden until copying begins

**Total Time for Import counter**:
- Added a live "Total Time: M:SS" display that starts ticking from the moment "Start Import" is clicked
- Timer captures the full duration including the scan/preparation phase
- Freezes at final value when import completes or is cancelled
- Helper methods: `formatElapsed()`, `startElapsedTimer()`, `stopElapsedTimer()`

**Stats row layout**:
- Changed from wrapping grid to single-row `flex-wrap: nowrap` layout (`stats-pills-row` CSS class)
- All stat pills fit on one line with `flex: 1` equal widths
- "Time Remaining" pill: yellow (`--warning-color`)
- "Total Time" pill: green (`--success-color`)
- Current file display uses `text-overflow: ellipsis` to prevent wrapping

**Files modified**: `public/js/importWizard.js`, `public/css/styles.css`

### Merge Progress Continuous Feedback

**Issue**: Merge progress screen stayed at "Starting merge… 0 / 0" with no updates because progress events were only emitted *after* each complete file was copied, and the initial state showed nothing.

**Fix**:
1. `executeMerge()` now emits an immediate `merge:progress` event (via `emitEvent`, bypassing throttle) at startup — UI instantly shows "Preparing merge (N files to copy)…" and the correct total file count
2. The `copyFileWithProgress()` callback (previously empty) now calls `emitProgress()` on every chunk, providing continuous byte-level progress updates throttled at 500ms
3. A definitive post-file event is also emitted after each file completes to keep counts accurate
4. `handleProgressUpdate()` uses `bytesPercentage` for the progress bar (smooth) with fallback to `filesPercentage`
5. Socket ID guard added to `startMerge()` — shows clear error if Socket.IO is not connected

**Files modified**: `src/services/mergeService.js`, `public/js/mergeWizard.js`

### Merge Wizard Step 4 UX Fix

**Issue**: Step 4 (Confirm Merge) had two "Start Merge" buttons — one inside the scrollable content area and one "Next →" always-visible footer button. Users clicked "Next →" which rendered the progress screen without starting the merge, causing the screen to appear permanently stuck.

**Fix**:
- Footer button on step 4 now reads **"Start Merge →"** (green, `btn-success` style) and calls `startMerge()` directly
- `nextStep()` intercepts step 4 and calls `startMerge()` instead of advancing to step 5
- Duplicate inline "Start Merge / Back to Preview" buttons removed from step 4 content
- Insufficient-space warning shown as a red banner; footer button disabled in that case
- Added `btn-success` CSS class for green action buttons

**Files modified**: `public/js/mergeWizard.js`, `public/css/styles.css`

### Future Enhancement Ideas

- Cross-platform support (macOS, Linux)
- Windows installer package
- Backup and restore features
- Advanced filtering and sorting options
- Export capabilities (CSV, reports)
- Batch operations on multiple objects
- Image preview/thumbnail display
- Stacking quality metrics
- Weather and seeing condition logging
- Image comparison and quality assessment
- Session planning and scheduling
