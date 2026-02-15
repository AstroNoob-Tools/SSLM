# SSLM - SeaStar Library Manager

## Project Overview

SSLM (SeaStar Library Manager) is an application that manages astrophotography files from a SeeStar telescope device. The primary goals are to:
- Import and maintain local copies of SeeStar device content (never work directly on device)
- Organize astronomical images by celestial objects
- Provide dashboard with collection statistics (objects, sub-frames, etc.)
- Manage both import and local copy scenarios
- Clean up unnecessary files to optimize storage

### Current Development Phase
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
- Displays statistics:
  - Total files from each source library
  - Duplicates detected (same relative path across sources)
  - Conflicts found (files that exist in multiple sources with differences)
  - Final file count after deduplication
  - Space requirements vs available space
- Shows conflict resolution preview (first 10 examples)
- Conflict table shows: File Path, Source 1 info, Source 2 info, Resolution (which wins)

**Step 4: Confirmation**
- Summary cards with key statistics
- Source libraries count and paths
- Destination path
- Files: original total → final count
- Space required vs available
- Conflict resolution strategy reminder
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

**Testing Status:**
- ✅ Successfully tested with 2 identical libraries (proper duplicate detection)
- 🔄 Ongoing testing with real library copies

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
- **Imaging Sessions Table**:
  - Date and time of each imaging session
  - Number of stacked frames
  - Exposure time
  - Filter used
  - Total integration time per session
- **File Lists**:
  - Main folder files with capture dates
  - Sub-frames folder files with capture dates
  - Grouped by file type (.fit, .jpg, thumbnails, videos)
  - Expandable sections for each file type
- **Individual Cleanup**: Button to clean sub-frame directory for this object

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
