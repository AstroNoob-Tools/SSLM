# SSLM - SeaStar Library Manager

## Project Overview

SSLM (SeaStar Library Manager) is an application that manages astrophotography files from a SeeStar telescope device. The primary goals are to:
- Import and maintain local copies of SeeStar device content (never work directly on device)
- Organize astronomical images by celestial objects
- Provide dashboard with collection statistics (objects, sub-frames, etc.)
- Manage both import and local copy scenarios
- Clean up unnecessary files to optimize storage

### Current Development Phase
**Phase 1**: Initial setup workflow and dashboard implementation
- User selection: Import from SeeStar or use existing local copy
- File import process with progress indication
- Dashboard displaying aggregated collection statistics

## Domain Context

### SeeStar Device
SeeStar is an astrophotography telescope that captures images of celestial objects. Files are stored on the device under a root directory called `MyWork`.

**Connection Methods**:
1. **Removable/External Drive** (default): SeeStar appears as a drive letter (e.g., E:\, F:\)
   - Access path: `E:\MyWork` or `F:\MyWork` (depending on assigned drive letter)
   - Most common connection method

2. **Network Drive** (station mode): SeeStar accessible via network
   - Network path: `\\seestar\MyWork`
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
   - Verify `/MyWork` directory exists on device

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
   - Verify `/MyWork` directory exists

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
   - Copy files from SeeStar `/MyWork` to chosen local directory
   - Show real-time progress:
     - Current file being copied
     - Number of files copied / total files
     - Data transferred (MB/GB)
     - Estimated time remaining

3. **Local Copy Selection** (if user chooses existing copy)
   - Ask user: "Where is your local copy of the SeeStar content located?"
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
- Validate `/MyWork` directory exists before operations

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
