# SSLM - SeeStar Library Manager

🔭 A local web application for managing astrophotography files from SeeStar telescope devices.

**SSLM** (SeeStar Library Manager) helps you organize, analyze, and maintain your astrophotography library with an intuitive web-based dashboard.

## ✨ Features

### 📊 Interactive Dashboard
- **Collection Statistics**: View total objects, file counts, storage usage, and date ranges at a glance
- **Sidebar Navigation**: Quick access to all dashboard sections (Summary, File Types, Catalogs, Objects)
- **Catalog Breakdown**: See your collection organized by astronomical catalogs (Messier, NGC, IC, SH)
- **File Type Analysis**: Detailed breakdown of .FIT files, JPGs, thumbnails, and videos
- **Search & Filter**: Quickly find objects by name or catalog

### 🎯 Object Management
- **Detailed Object View**: Complete information for each celestial object
- **Sub-Frame Detection**: Automatically identifies objects with sub-frame directories
- **Integration Time Tracking**: View total integration time per object
- **Sub-Frame Statistics**: See breakdown of .fit files vs other files in sub-frame folders

### 🧹 Cleanup & Optimization
- **Empty Directory Cleanup**: Identify and delete empty directories safely
- **Sub-Frame Optimization**: Remove unnecessary JPG and thumbnail files from sub-frame folders
  - Global cleanup: Clean all sub-frame directories at once
  - Individual cleanup: Clean specific objects with a single click
  - Safe operation: Your .fit files are never touched
- **Storage Savings**: Track freed space after cleanup operations

### 📥 Import & Organization
- **Import from SeeStar**: Copy files from connected SeeStar device
  - Removable drive support (E:\, F:\, etc.)
  - Network path support (\\seestar)
- **Work with Local Copies**: Manage existing local astrophotography collections
- **Smart File Detection**: Automatically recognizes SeeStar file structure
  - Main object directories
  - Sub-frame directories (_sub folders)
  - Mosaic captures

### 🌐 Mode Support
- **Offline Mode** (default): Full functionality without internet connection
- **Online Mode**: Additional features when internet is available
- **Settings Management**: Configure default import strategy and operating mode

## 🚀 Quick Start

### Requirements
- Node.js 18 or higher
- Windows OS (initial release, cross-platform support planned)

### Installation

```bash
# Clone or download the repository
cd SeeStarFileManager

# Install dependencies
npm install

# Start the application
npm start
```

The application will start at `http://localhost:3000`

### Development Mode

```bash
# Run with auto-reload (requires nodemon)
npm run dev
```

## 📖 Usage

### First Time Setup

1. **Start the application**
   ```bash
   npm start
   ```

2. **Open your browser** to `http://localhost:3000`

3. **Choose your mode**:
   - **Import from SeeStar**: Copy files from your connected device
   - **Work with local copy**: Use an existing local directory

### Import from SeeStar

1. Connect your SeeStar device (USB or network)
2. Select "Import from SeeStar"
3. Choose connection type:
   - Removable drive (auto-detected)
   - Network path: `\\seestar`
4. Select import strategy:
   - **Copy Everything**: Full copy (new imports)
   - **Incremental Copy**: Only new/changed files (updates)
5. Choose destination folder (ensure ~50GB free space)
6. Monitor progress and view dashboard when complete

### Work with Local Copy

1. Select "Work with local copy"
2. Browse to your existing SeeStar directory
3. Dashboard loads immediately with collection statistics

### Dashboard Features

**Summary Section**:
- Total objects count
- Objects with/without sub-frames
- Total storage used
- Total file count
- Empty directories warning

**File Types Section**:
- .FIT files count
- JPG files count
- Thumbnail files count
- Video files (.mp4) count

**Catalogs Section**:
- Breakdown by astronomical catalog (M, NGC, IC, SH)

**Empty Directories**:
- List of empty directories
- One-click deletion

**Cleanup Section**:
- Sub-frame cleanup suggestions
- Space savings estimate
- Global or individual cleanup options

**Objects Section**:
- Searchable object list
- Sub-frame file breakdown (.fit vs other)
- Integration time per object
- Individual cleanup buttons
- Total files and size per object

## 🗂️ Project Structure

```
SSLM/
├── server.js              # Main Express server
├── package.json           # Project dependencies
├── config/                # Configuration files
│   └── settings.json      # User settings (created on first run)
├── src/                   # Backend source code
│   ├── services/          # Business logic
│   │   ├── fileAnalyzer.js    # Directory analysis
│   │   ├── fileCleanup.js     # Cleanup operations
│   │   └── catalogParser.js   # Catalog name parsing
│   └── utils/             # Utility functions
│       └── directoryBrowser.js # File system operations
├── public/                # Frontend static files
│   ├── index.html         # Main HTML
│   ├── css/               # Stylesheets
│   │   └── styles.css
│   └── js/                # JavaScript files
│       ├── app.js             # Main application logic
│       ├── dashboard.js       # Dashboard rendering
│       ├── modeSelection.js   # Mode selection wizard
│       └── importWizard.js    # Import wizard
└── CLAUDE.md             # Project documentation
```

## 🔧 Technical Details

### Technology Stack
- **Backend**: Node.js + Express.js
- **Real-time**: Socket.IO
- **File Operations**: fs-extra
- **Frontend**: Vanilla JavaScript + CSS
- **Architecture**: Local web application (no internet required)

### File Format Support
- **.fit (FITS)**: Flexible Image Transport System files
- **.jpg**: Preview images
- **_thn.jpg**: Thumbnail images
- **.mp4**: Video files

### Supported Catalogs
- **Messier (M)**: M 42, M 45, M 47, etc.
- **New General Catalogue (NGC)**: NGC 1365, NGC 2024, etc.
- **Index Catalogue (IC)**: IC 434, IC 2177, etc.
- **Sharpless (SH)**: SH 2-3, SH 2-54, etc.
- **Named Objects**: Large Magellanic Cloud, etc.

## 🛡️ Safety Features

- **Read-only on SeeStar**: Never modifies files on the device
- **Confirmation dialogs**: All destructive operations require confirmation
- **.fit file protection**: Cleanup operations never delete .fit files
- **Empty directory check**: Double-checks directories are empty before deletion
- **Progress tracking**: Real-time feedback during operations
- **Error handling**: Comprehensive error reporting and recovery

## 🎨 Interface Features

- **Modern UI**: Clean, dark-themed interface optimized for readability
- **Responsive Design**: Adapts to different screen sizes
- **Smooth Navigation**: Sidebar navigation with smooth scrolling
- **Real-time Updates**: Dashboard refreshes after cleanup operations
- **Loading Indicators**: Visual feedback during long operations
- **Modal Dialogs**: Clean confirmation and result displays

## 📝 Configuration

Settings are stored in `config/settings.json`:

```json
{
  "server": {
    "port": 3000,
    "host": "localhost"
  },
  "mode": {
    "online": false
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

## 🐛 Known Limitations

- Windows support only (currently)
- SeeStar device required for import functionality
- Large collections (>10,000 files) may take time to analyze
- Maximum 50mb payload size for cleanup operations

## 🔮 Future Enhancements

- Cross-platform support (macOS, Linux)
- Windows installer package
- Incremental import functionality
- File import with progress tracking
- Backup and restore features
- Advanced filtering and sorting
- Export capabilities
- Batch operations

## 📄 License

ISC

## 🙏 Acknowledgments

Built for the astrophotography community using SeeStar telescopes.

---

**Version**: 1.0.0
**Status**: Active Development
**Platform**: Windows (Node.js)
