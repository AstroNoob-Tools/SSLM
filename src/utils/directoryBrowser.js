const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class DirectoryBrowser {
    /**
     * Get list of available drives on Windows
     */
    static async getWindowsDrives() {
        const drives = [];

        // Check drives from C: to Z:
        for (let i = 67; i <= 90; i++) { // ASCII: C=67, Z=90
            const driveLetter = String.fromCharCode(i);
            const drivePath = `${driveLetter}:\\`;

            try {
                await fs.access(drivePath);
                const stats = await fs.stat(drivePath);
                drives.push({
                    path: drivePath,
                    name: `${driveLetter}:`,
                    type: 'drive',
                    exists: true
                });
            } catch (error) {
                // Drive doesn't exist or not accessible
            }
        }

        return drives;
    }

    /**
     * Get directory contents
     */
    static async getDirectoryContents(directoryPath) {
        try {
            // Validate path exists
            const exists = await fs.pathExists(directoryPath);
            if (!exists) {
                return { error: 'Path does not exist', items: [] };
            }

            // Check if it's a directory
            const stats = await fs.stat(directoryPath);
            if (!stats.isDirectory()) {
                return { error: 'Path is not a directory', items: [] };
            }

            // Read directory contents
            const items = await fs.readdir(directoryPath);
            const itemDetails = [];

            for (const item of items) {
                try {
                    const itemPath = path.join(directoryPath, item);
                    const itemStats = await fs.stat(itemPath);

                    // Only include directories
                    if (itemStats.isDirectory()) {
                        itemDetails.push({
                            name: item,
                            path: itemPath,
                            type: 'directory',
                            modified: itemStats.mtime
                        });
                    }
                } catch (error) {
                    // Skip items we can't access
                    console.warn(`Cannot access: ${item}`);
                }
            }

            // Sort directories alphabetically
            itemDetails.sort((a, b) => a.name.localeCompare(b.name));

            return {
                currentPath: directoryPath,
                parentPath: path.dirname(directoryPath),
                items: itemDetails
            };
        } catch (error) {
            return {
                error: error.message,
                currentPath: directoryPath,
                items: []
            };
        }
    }

    /**
     * Get common user directories
     */
    static getCommonDirectories() {
        const home = os.homedir();
        const common = [
            { name: 'Home', path: home, type: 'common' },
            { name: 'Desktop', path: path.join(home, 'Desktop'), type: 'common' },
            { name: 'Documents', path: path.join(home, 'Documents'), type: 'common' },
            { name: 'Downloads', path: path.join(home, 'Downloads'), type: 'common' }
        ];

        return common.filter(dir => {
            try {
                return fs.existsSync(dir.path);
            } catch {
                return false;
            }
        });
    }

    /**
     * Validate if path contains MyWork directory (for SeeStar source validation)
     */
    static async hasMyWorkDirectory(directoryPath) {
        try {
            const myWorkPath = path.join(directoryPath, 'MyWork');
            return await fs.pathExists(myWorkPath);
        } catch {
            return false;
        }
    }
}

module.exports = DirectoryBrowser;
