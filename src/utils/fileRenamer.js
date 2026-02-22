'use strict';

const fs   = require('fs-extra');
const path = require('path');

class FileRenamer {

  /**
   * Renames an astronomical object in the library.
   * All folders named exactly `fromName` or starting with `fromName_` are renamed,
   * and every file inside those folders whose name contains `fromName` is renamed too.
   *
   * Safe execution order:
   *   1. Pre-flight checks (source exists, target doesn't conflict)
   *   2. Rename files inside each related folder
   *   3. Rename the folders themselves
   *
   * @param {string} libraryPath  - Root library directory (e.g. "H:\SeeStar-20260212")
   * @param {string} fromName     - Current object name   (e.g. "M 42")
   * @param {string} toName       - New object name       (e.g. "NGC 1976")
   * @returns {Promise<{success, renamedFolders, renamedFiles, errors, newName}>}
   */
  static async renameObject(libraryPath, fromName, toName) {

    // ── Validation ────────────────────────────────────────────────────────────
    if (!libraryPath || !fromName || !toName) {
      return { success: false, error: 'libraryPath, fromName and toName are required' };
    }
    if (fromName === toName) {
      return { success: false, error: 'fromName and toName are the same' };
    }
    if (!await fs.pathExists(libraryPath)) {
      return { success: false, error: `Library path does not exist: ${libraryPath}` };
    }

    // ── Discover all folders that belong to this object ───────────────────────
    let entries;
    try {
      entries = await fs.readdir(libraryPath);
    } catch (err) {
      return { success: false, error: `Cannot read library directory: ${err.message}` };
    }

    // Match exact name ("M 42") and suffixed variants ("M 42_sub", "M 42_mosaic", etc.)
    const relatedFolders = entries.filter(entry =>
      entry === fromName || entry.startsWith(fromName + '_')
    );

    if (!relatedFolders.includes(fromName)) {
      return { success: false, error: `Object "${fromName}" not found in library` };
    }

    // ── Conflict check: none of the target names may already exist ────────────
    for (const folder of relatedFolders) {
      const targetFolder = folder.split(fromName).join(toName);
      if (await fs.pathExists(path.join(libraryPath, targetFolder))) {
        return {
          success: false,
          error: `Target "${targetFolder}" already exists in the library — rename aborted`
        };
      }
    }

    // ── Execute rename ────────────────────────────────────────────────────────
    const renamedFiles   = [];
    const renamedFolders = [];
    const errors         = [];

    // Step A: rename files inside each folder first
    for (const folder of relatedFolders) {
      const folderPath = path.join(libraryPath, folder);
      const stat = await fs.stat(folderPath);
      if (!stat.isDirectory()) continue;

      let files;
      try {
        files = await fs.readdir(folderPath);
      } catch (err) {
        errors.push(`Cannot read folder "${folder}": ${err.message}`);
        continue;
      }

      for (const file of files) {
        if (!file.includes(fromName)) continue;

        const newFile  = file.split(fromName).join(toName);
        const oldPath  = path.join(folderPath, file);
        const newPath  = path.join(folderPath, newFile);

        try {
          await fs.rename(oldPath, newPath);
          renamedFiles.push({ from: file, to: newFile, inFolder: folder });
        } catch (err) {
          errors.push(`Failed to rename file "${file}" in "${folder}": ${err.message}`);
        }
      }
    }

    // Step B: rename the folders themselves
    for (const folder of relatedFolders) {
      const targetFolder = folder.split(fromName).join(toName);
      const oldPath      = path.join(libraryPath, folder);
      const newPath      = path.join(libraryPath, targetFolder);

      try {
        await fs.rename(oldPath, newPath);
        renamedFolders.push({ from: folder, to: targetFolder });
      } catch (err) {
        errors.push(`Failed to rename folder "${folder}": ${err.message}`);
      }
    }

    return {
      success: errors.length === 0,
      renamedFolders,
      renamedFiles,
      errors,
      newName: toName
    };
  }
}

module.exports = FileRenamer;
