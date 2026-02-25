/**
 * Catalog Parser Service
 * Parses astronomical object names and identifies catalog types
 */

class CatalogParser {
    /**
     * Parse an object folder name and extract catalog information
     * @param {string} folderName - The folder name to parse
     * @returns {Object} Parsed object information
     */
    static parseObjectName(folderName) {
        // Detect sub-frame folder by suffix:
        //   _sub  →  Eq mount mode
        //   -sub  →  Alt/Az mount mode
        const isSubFolderEq    = folderName.endsWith('_sub');
        const isSubFolderAltAz = !isSubFolderEq && folderName.endsWith('-sub');
        const isSubFolder      = isSubFolderEq || isSubFolderAltAz;

        let baseName  = folderName;
        let mountMode = null;
        if (isSubFolderEq) {
            baseName  = folderName.slice(0, -4); // strip '_sub' (4 chars)
            mountMode = 'eq';
        } else if (isSubFolderAltAz) {
            baseName  = folderName.slice(0, -4); // strip '-sub' (4 chars)
            mountMode = 'altaz';
        }

        // Extract catalog type and details
        const catalogInfo = this.identifyCatalog(baseName);

        return {
            originalName:  folderName,
            baseName:      baseName,
            isSubFolder:   isSubFolder,
            mountMode:     mountMode, // 'eq' | 'altaz' | null
            catalog:       catalogInfo.catalog,
            catalogNumber: catalogInfo.number,
            displayName:   catalogInfo.displayName,
            variant:       catalogInfo.variant
        };
    }

    /**
     * Identify the catalog type from an object name
     * @param {string} name - The object name
     * @returns {Object} Catalog information
     */
    static identifyCatalog(name) {
        // Messier catalog (M 1 - M 110)
        const messierMatch = name.match(/^M\s*(\d+)(.*)$/i);
        if (messierMatch) {
            return {
                catalog: 'Messier',
                number: parseInt(messierMatch[1]),
                displayName: `M ${messierMatch[1]}`,
                variant: messierMatch[2].trim() || null
            };
        }

        // NGC catalog (New General Catalogue)
        const ngcMatch = name.match(/^NGC\s*(\d+)(.*)$/i);
        if (ngcMatch) {
            return {
                catalog: 'NGC',
                number: parseInt(ngcMatch[1]),
                displayName: `NGC ${ngcMatch[1]}`,
                variant: ngcMatch[2].trim() || null
            };
        }

        // IC catalog (Index Catalogue)
        const icMatch = name.match(/^IC\s*(\d+)(.*)$/i);
        if (icMatch) {
            return {
                catalog: 'IC',
                number: parseInt(icMatch[1]),
                displayName: `IC ${icMatch[1]}`,
                variant: icMatch[2].trim() || null
            };
        }

        // Sharpless catalog (SH 2-xxx)
        const sharplessMatch = name.match(/^SH\s*2[-\s]*(\d+)(.*)$/i);
        if (sharplessMatch) {
            return {
                catalog: 'Sharpless',
                number: parseInt(sharplessMatch[1]),
                displayName: `SH 2-${sharplessMatch[1]}`,
                variant: sharplessMatch[2].trim() || null
            };
        }

        // Caldwell catalog
        const caldwellMatch = name.match(/^C\s*(\d+)(.*)$/i);
        if (caldwellMatch) {
            return {
                catalog: 'Caldwell',
                number: parseInt(caldwellMatch[1]),
                displayName: `C ${caldwellMatch[1]}`,
                variant: caldwellMatch[2].trim() || null
            };
        }

        // Named objects (everything else)
        return {
            catalog: 'Named',
            number: null,
            displayName: name,
            variant: null
        };
    }

    /**
     * Check if a folder name is a sub-frame folder
     * @param {string} folderName - The folder name
     * @returns {boolean}
     */
    static isSubFrameFolder(folderName) {
        return folderName.endsWith('_sub') || folderName.endsWith('-sub');
    }

    /**
     * Get the base name from a sub-frame folder
     * @param {string} folderName - The folder name
     * @returns {string}
     */
    static getBaseName(folderName) {
        if (folderName.endsWith('_sub') || folderName.endsWith('-sub')) {
            return folderName.slice(0, -4);
        }
        return folderName;
    }

    /**
     * Check if a folder name indicates a mosaic capture
     * @param {string} folderName - The folder name
     * @returns {boolean}
     */
    static isMosaic(folderName) {
        return folderName.toLowerCase().includes('_mosaic');
    }

    /**
     * Extract date information from filename
     * @param {string} filename - The filename
     * @returns {Date|null}
     */
    static extractDateFromFilename(filename) {
        // Pattern: YYYYMMDD-HHMMSS
        const dateMatch = filename.match(/(\d{8})-(\d{6})/);
        if (dateMatch) {
            const dateStr = dateMatch[1]; // YYYYMMDD
            const timeStr = dateMatch[2]; // HHMMSS

            const year = dateStr.substring(0, 4);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);

            const hour = timeStr.substring(0, 2);
            const minute = timeStr.substring(2, 4);
            const second = timeStr.substring(4, 6);

            return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
        }
        return null;
    }

    /**
     * Extract stacking count from filename
     * @param {string} filename - The filename
     * @returns {number|null}
     */
    static extractStackingCount(filename) {
        // Pattern: Stacked_NNN_ or DSO_Stacked_NNN_
        const stackMatch = filename.match(/Stacked_(\d+)_/);
        if (stackMatch) {
            return parseInt(stackMatch[1]);
        }
        return null;
    }

    /**
     * Extract exposure time from filename
     * @param {string} filename - The filename
     * @returns {number|null} Exposure in seconds
     */
    static extractExposure(filename) {
        // Pattern: 30.0s or 10.0s
        const exposureMatch = filename.match(/(\d+\.?\d*)s/);
        if (exposureMatch) {
            return parseFloat(exposureMatch[1]);
        }
        return null;
    }

    /**
     * Extract filter information from filename
     * @param {string} filename - The filename
     * @returns {string|null}
     */
    static extractFilter(filename) {
        // Common filters: IRCUT, LP (Light Pollution), etc.
        const filterMatch = filename.match(/_(IRCUT|LP|UHC|OIII|Ha|SII)_/i);
        if (filterMatch) {
            return filterMatch[1].toUpperCase();
        }
        return null;
    }
}

module.exports = CatalogParser;
