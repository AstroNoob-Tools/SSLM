# SSLM - Functionality & Technical Overview

This document provides a detailed breakdown of the internal logic, capabilities, and data handling processes of the SeeStar Library Manager (SSLM). It is intended for users who want a deeper understanding of how the application manages their data.

---

## 1. Core Architecture

SSLM is a **local-first** application designed with a strict "read-only source" philosophy to ensure data safety.

- **Backend**: Node.js with Express.
- **Frontend**: Vanilla JavaScript (ES6+) with real-time updates via Socket.IO.
- **File Operations**: Utilizes `fs-extra` for robust filesystem interactions.
- **Concurrency**: Operations are designed to be non-blocking where possible, with heavy I/O tasks (like imports) running asynchronously and reporting progress via WebSockets.

---

## 2. Import Engine

The import engine is responsible for transferring data from the SeeStar S50 (or other sources) to the local library.

### Device Detection
- **USB Mode**: Automatically scans all mounted Windows drives (C: through Z:) looking for the specific `MyWorks` directory signature.
- **Network Mode**: Supports direct addressing of the Seestar via SMB (`\\seestar\MyWorks`).

### Transfer Logic
SSLM employs two distinct import strategies:

1.  **Full Copy**: A blind copy of all files. Used for initial backups.
2.  **Incremental Copy (Smart Sync)**:
    - Iterates through the source directory tree.
    - For each file, checks if a corresponding file exists in the destination.
    - **Comparison Criteria**: A file is skipped *only* if independent verification confirms:
        - Filename matches.
        - File size (in bytes) is identical.
        - Modification timestamp is identical (or newer in destination).
    - This logic drastically reduces import times for regular backups.

### Data Validation
- **Post-Transfer Verification**: After an import operation, an optional validation step re-scans identifying any discrepancies between source and destination file sizes to ensure data integrity.

---

## 3. Merge & Deduplication Engine

The Merge engine allows users to consolidate multiple partial backups (e.g., "Laptop Library" and "External Drive Backup") into a single, complete "Master Library".

### Deduplication Logic
The merge process builds a virtual map of all files across all source libraries before moving a single byte.

- **Relative Path Identity**: Files are identified by their path relative to the library root (e.g., `\M 42\Stacked_...fit`).
- **Conflict Resolution**: When the same file (same relative path) exists in multiple sources:
    - The engine compares the **Last Modified Date** of all versions.
    - **Winner**: The newest version is selected for the merged library.
    - **Loser**: Older versions are discarded (not copied).
    - *Note: Source files are never deleted; they are simply not copied to the new destination.*

### Space Calculation
- **Predictive Sizing**: The engine calculates the required disk space *after* deduplication logic is applied, preventing "disk full" errors midway through a merge.

---

## 4. Astrometric Data Parsing

SSLM parses the standardized Seestar file naming convention to extract metadata without needing to read the FITS headers (which would be slow for large libraries).

### Filename Parsing
filenames are tokenized to extract:
- **Object Name**: `NGC 6729`, `M 42`, etc.
- **Exposure**: `10s`, `20s`, `30s`.
- **Filter**: `IRCUT`, `LP`, `Dualband`.
- **Timestamp**: `YYYYMMDD-HHMMSS`.
- **Frame Count**: (For stacked images) Used to calculate total integration time.

### Catalog Recognition
The `catalogParser.js` module uses regex patterns to categorize objects into:
- **Solar System**: Sun, Moon, Planets.
- **Deep Sky**: Messier (`M`), NGC, IC, Sharpless (`SH`), Caldwell (`C`).
- **Stars/Other**: Named stars (e.g., `Betelgeuse`) or custom object names.

---

## 5. Storage Optimization (Cleanup)

The Cleanup module is designed to reclaim disk space without touching scientific data.

### Targeted File Types
Cleanup operations differ from standard "delete" commands. They strictly target **non-essential derivative files** within `_sub` directories:
- **Targets**: `*.jpg` (previews), `*_thn.jpg` (thumbnails).
- **Protected**: `*.fit` (FITS data), `*.mp4` (videos), and any files in the main object directory (stacked results).

### Safety Mechanisms
- **Context Awareness**: Cleanup is only available for `_sub` directories. The main object directories (containing your final stacks) are never subjected to bulk cleanup.
- **Empty Directory Pruning**: Recursive removal of directories that contain 0 files (often left over from renaming objects on the mobile app).

---

## 6. Library Analytics

The `fileAnalyzer.js` service builds a real-time valid JSON representation of the library state.

### Integration Time Calculation
Total integration time is not just a sum of file counts. It is calculated by:
- **Stacked Images**: `Frame Count * Exposure Time`.
- **Sub-Frames**: `Count * Exposure Time`.
- **Aggregation**: These values are aggregated per object, per session, per catalog, and for the global library.

### Session Grouping
Images are programmatically grouped into "Sessions" based on temporal proximity and identical capture parameters (Filter + Exposure), allowing users to view their data as logical events rather than just a flat list of files.
