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
- ✅ File import process with progress indication
- ✅ Interactive dashboard with collection statistics
- ✅ Object detail pages with comprehensive metadata
- ✅ Catalog detail pages for catalog-specific views
- ✅ Cleanup operations for optimizing storage
- ✅ Favorites system for quick folder access

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

## Implemented Features (Phase 1 Complete)

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

#### Directory Browsing
- GET /api/browse/drives - Get available drives and common paths
- GET /api/browse/directory?path={path} - Get directory contents
- GET /api/browse/validate?path={path}&checkMyWork={bool} - Validate path

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

### Future Enhancement Ideas
- Cross-platform support (macOS, Linux)
- Windows installer package
- Incremental import functionality (in progress)
- File import with real-time progress tracking
- Backup and restore features
- Advanced filtering and sorting options
- Export capabilities (CSV, reports)
- Batch operations on multiple objects
- Image preview/thumbnail display
- Stacking quality metrics
- Weather and seeing condition logging
