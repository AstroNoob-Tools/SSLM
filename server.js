const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const fs = require('fs-extra');
const DirectoryBrowser = require('./src/utils/directoryBrowser');
const FileAnalyzer = require('./src/services/fileAnalyzer');
const FileCleanup = require('./src/services/fileCleanup');
const ImportService = require('./src/services/importService');
const MergeService = require('./src/services/mergeService');
const DiskSpaceValidator = require('./src/utils/diskSpaceValidator');
const FileRenamer = require('./src/utils/fileRenamer');

// Detect if running as a pkg-bundled executable
const isPackaged = typeof process.pkg !== 'undefined';

// Read version from sslm.iss (source of truth), fall back to package.json
function readAppVersion() {
  try {
    const issPath = path.join(__dirname, 'installer', 'sslm.iss');
    const issContent = fs.readFileSync(issPath, 'utf8');
    const match = issContent.match(/#define AppVersion\s+"([^"]+)"/);
    if (match) return match[1];
  } catch (_) { /* file not found or unreadable */ }
  return require('./package.json').version;
}
const APP_VERSION = readAppVersion();

// Create Express app
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Load configuration
// When packaged, store user config in %APPDATA%\SSLM (writable).
// In development, use the local config/ directory.
const configDir = isPackaged
  ? path.join(process.env.APPDATA || process.env.HOME || '.', 'SSLM')
  : path.join(__dirname, 'config');
const configPath = path.join(configDir, 'settings.json');
let config = {};

try {
  config = fs.readJSONSync(configPath);
} catch (error) {
  console.log('Config file not found, using defaults');
  config = {
    server: { port: 3000, host: 'localhost' },
    mode: { online: false },
    seestar: { directoryName: 'MyWorks' },
    paths: { lastSourcePath: '', lastDestinationPath: '' },
    preferences: { defaultImportStrategy: 'incremental' }
  };
  // When packaged, persist the default config to APPDATA on first run
  if (isPackaged) {
    try {
      fs.ensureDirSync(configDir);
      fs.writeJSONSync(configPath, config, { spaces: 2 });
    } catch (err) {
      console.warn('Could not write default config to APPDATA:', err.message);
    }
  }
}

// Always start in offline mode — user must explicitly enable online features each session
config.mode.online = false;

// Initialize ImportService and MergeService with Socket.IO and config
const importService = new ImportService(io, config);
const mergeService = new MergeService(io, config);

const PORT = process.env.PORT || config.server.port || 3000;
const HOST = config.server.host || 'localhost';

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    version: '1.0.0',
    mode: config.mode.online ? 'online' : 'offline',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/config', (req, res) => {
  res.json({
    version: APP_VERSION,
    mode: config.mode,
    preferences: config.preferences,
    seestar: config.seestar,
    paths: {
      hasLastSource: !!config.paths.lastSourcePath,
      hasLastDestination: !!config.paths.lastDestinationPath
    }
  });
});

app.post('/api/config', async (req, res) => {
  try {
    // Update config with new values
    config = { ...config, ...req.body };

    // Save to file
    await fs.writeJSON(configPath, config, { spaces: 2 });

    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Image serving endpoint
app.get('/api/image', async (req, res) => {
  try {
    const { path: imagePath } = req.query;

    if (!imagePath) {
      return res.status(400).json({ success: false, error: 'Image path is required' });
    }

    // Check if file exists
    const exists = await fs.pathExists(imagePath);
    if (!exists) {
      return res.status(404).json({ success: false, error: 'Image not found' });
    }

    // Determine content type based on file extension
    const ext = path.extname(imagePath).toLowerCase();
    const contentTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.tif': 'image/tiff',
      '.tiff': 'image/tiff'
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';

    // Set content type and send file
    res.setHeader('Content-Type', contentType);
    res.sendFile(imagePath);
  } catch (error) {
    console.error('Error serving image:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Favorites API Routes
app.get('/api/favorites', (req, res) => {
  try {
    const favorites = config.favorites || [];
    res.json({ success: true, favorites });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/favorites/add', async (req, res) => {
  try {
    const { path: favPath, name } = req.body;

    if (!favPath) {
      return res.status(400).json({ success: false, error: 'Path required' });
    }

    // Initialize favorites if not exists
    if (!config.favorites) {
      config.favorites = [];
    }

    // Check if already exists
    const exists = config.favorites.some(fav => fav.path === favPath);
    if (exists) {
      return res.json({ success: true, message: 'Path already in favorites', favorites: config.favorites });
    }

    // Add to favorites
    config.favorites.push({
      path: favPath,
      name: name || path.basename(favPath),
      addedAt: new Date().toISOString()
    });

    // Save to file
    await fs.writeJSON(configPath, config, { spaces: 2 });

    res.json({ success: true, favorites: config.favorites });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/favorites/remove', async (req, res) => {
  try {
    const { path: favPath } = req.body;

    if (!favPath) {
      return res.status(400).json({ success: false, error: 'Path required' });
    }

    if (!config.favorites) {
      config.favorites = [];
    }

    // Remove from favorites
    config.favorites = config.favorites.filter(fav => fav.path !== favPath);

    // Save to file
    await fs.writeJSON(configPath, config, { spaces: 2 });

    res.json({ success: true, favorites: config.favorites });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Directory Browser API Routes
app.get('/api/browse/drives', async (req, res) => {
  try {
    const drives = await DirectoryBrowser.getWindowsDrives();
    const common = DirectoryBrowser.getCommonDirectories();

    res.json({
      success: true,
      drives,
      common
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/browse/directory', async (req, res) => {
  try {
    const { path: directoryPath } = req.query;

    if (!directoryPath) {
      return res.status(400).json({ success: false, error: 'Path parameter required' });
    }

    const result = await DirectoryBrowser.getDirectoryContents(directoryPath);

    res.json({
      success: !result.error,
      currentPath: result.currentPath,
      parentPath: result.parentPath,
      directories: result.items || [],
      error: result.error
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/browse/create-directory', async (req, res) => {
  try {
    const { parentPath, folderName } = req.body;

    if (!parentPath || !folderName) {
      return res.status(400).json({
        success: false,
        error: 'parentPath and folderName required'
      });
    }

    // Validate parent path exists
    const parentExists = await fs.pathExists(parentPath);
    if (!parentExists) {
      return res.status(400).json({
        success: false,
        error: 'Parent directory does not exist'
      });
    }

    // Create the new directory path
    const newDirPath = path.join(parentPath, folderName);

    // Check if it already exists
    const alreadyExists = await fs.pathExists(newDirPath);
    if (alreadyExists) {
      return res.status(400).json({
        success: false,
        error: 'Directory already exists'
      });
    }

    // Create the directory
    await fs.ensureDir(newDirPath);

    res.json({
      success: true,
      path: newDirPath,
      message: 'Directory created successfully'
    });
  } catch (error) {
    console.error('Error creating directory:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/browse/validate', async (req, res) => {
  try {
    const { path: directoryPath, checkMyWork } = req.query;

    if (!directoryPath) {
      return res.status(400).json({ success: false, error: 'Path parameter required' });
    }

    const exists = await fs.pathExists(directoryPath);
    let hasMyWork = false;

    if (exists && checkMyWork === 'true') {
      hasMyWork = await DirectoryBrowser.hasMyWorkDirectory(directoryPath);
    }

    res.json({
      success: true,
      exists,
      hasMyWork,
      path: directoryPath
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// File Analysis API Routes
app.get('/api/analyze', async (req, res) => {
  try {
    const { path: directoryPath } = req.query;

    if (!directoryPath) {
      return res.status(400).json({ success: false, error: 'Path parameter required' });
    }

    console.log(`\n=== ANALYZE REQUEST ===`);
    console.log(`Raw path from query: "${directoryPath}"`);
    console.log(`Path length: ${directoryPath.length}`);
    console.log(`Path exists check...`);

    // Check if directory exists
    const exists = await fs.pathExists(directoryPath);
    console.log(`Directory exists: ${exists}`);

    if (!exists) {
      console.error(`ERROR: Directory not found at path: "${directoryPath}"`);
      return res.status(404).json({
        success: false,
        error: `Directory does not exist: ${directoryPath}`
      });
    }

    console.log(`Starting analysis...`);
    const result = await FileAnalyzer.analyzeDirectory(directoryPath);

    if (result.success) {
      console.log(`Analysis complete: ${result.summary.totalObjects} objects found in ${result.analysisTime}ms`);
    }

    res.json(result);
  } catch (error) {
    console.error(`Analysis error:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/analyze/cleanup-suggestions', async (req, res) => {
  try {
    const { path: directoryPath } = req.query;

    if (!directoryPath) {
      return res.status(400).json({ success: false, error: 'Path parameter required' });
    }

    const analysisResult = await FileAnalyzer.analyzeDirectory(directoryPath);

    if (!analysisResult.success) {
      return res.status(400).json(analysisResult);
    }

    const suggestions = FileAnalyzer.getSuggestedCleanup(analysisResult);

    res.json({
      success: true,
      suggestions
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cleanup API Routes
app.post('/api/cleanup/empty-directories', async (req, res) => {
  try {
    console.log('Empty directories cleanup request received');
    const { directories } = req.body;

    if (!directories || !Array.isArray(directories)) {
      console.error('Invalid request: directories array missing or not an array');
      return res.status(400).json({ success: false, error: 'Directories array required' });
    }

    console.log(`Deleting ${directories.length} empty directories...`);
    const result = await FileCleanup.deleteEmptyDirectories(directories);

    console.log(`Deleted ${result.totalDeleted} directories, ${result.totalFailed} failed`);

    res.json(result);
  } catch (error) {
    console.error('Error in empty directories cleanup:', error);
    res.status(500).json({ success: false, error: error.message, stack: error.stack });
  }
});

app.post('/api/cleanup/subframe-directories', async (req, res) => {
  try {
    console.log('Sub-frame cleanup request received');
    const { objects } = req.body;

    if (!objects || !Array.isArray(objects)) {
      console.error('Invalid request: objects array missing or not an array');
      return res.status(400).json({ success: false, error: 'Objects array required' });
    }

    console.log(`Cleaning up sub-frame directories for ${objects.length} objects...`);
    const result = await FileCleanup.cleanupSubFrameDirectories(objects);

    console.log(`Deleted ${result.totalFilesDeleted} files, freed ${FileCleanup.formatBytes(result.totalSpaceFreed)}`);

    res.json(result);
  } catch (error) {
    console.error('Error in sub-frame cleanup:', error);
    res.status(500).json({ success: false, error: error.message, stack: error.stack });
  }
});

app.get('/api/cleanup/subframe-info', async (req, res) => {
  try {
    const { path: directoryPath } = req.query;

    if (!directoryPath) {
      return res.status(400).json({ success: false, error: 'Path parameter required' });
    }

    const analysisResult = await FileAnalyzer.analyzeDirectory(directoryPath);

    if (!analysisResult.success) {
      return res.status(400).json(analysisResult);
    }

    const info = FileCleanup.getSubFrameCleanupInfo(analysisResult.objects);

    res.json({
      success: true,
      info
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete Session Files
app.post('/api/cleanup/session', async (req, res) => {
  try {
    const { mainFolderPath, mainFiles, subFiles } = req.body;

    if (!mainFolderPath || !mainFiles) {
      return res.status(400).json({ success: false, error: 'mainFolderPath and mainFiles are required' });
    }

    // subFiles is an array of { folder, file } objects — each entry carries its own
    // folder path, supporting files from both _sub (Eq) and -sub (Alt/Az) directories.
    const result = await FileCleanup.deleteSessionFiles({
      mainFolderPath,
      mainFiles,
      subFiles: subFiles || []
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Import API Routes
app.get('/api/import/detect-seestar', async (req, res) => {
  try {
    console.log('Detecting SeeStar devices...');
    const devices = await importService.detectSeeStarDevices();
    console.log(`Found ${devices.length} devices`);
    res.json({ success: true, devices });
  } catch (error) {
    console.error('Error detecting devices:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/import/validate-space', async (req, res) => {
  try {
    const { sourcePath, destinationPath, strategy, subframeMode } = req.body;

    if (!sourcePath || !destinationPath) {
      return res.status(400).json({
        success: false,
        error: 'sourcePath and destinationPath required'
      });
    }

    const importStrategy = strategy || 'full'; // Default to full if not specified
    const importSubframeMode = subframeMode || 'all';
    console.log(`Validating disk space (${importStrategy}, ${importSubframeMode}): ${sourcePath} -> ${destinationPath}`);
    const result = await DiskSpaceValidator.hasEnoughSpace(
      sourcePath,
      destinationPath,
      importStrategy,
      1.1,  // 10% safety buffer
      importSubframeMode
    );

    console.log(`Space validation: ${result.hasEnoughSpace ? 'OK' : 'INSUFFICIENT'} - Required: ${result.requiredFormatted}`);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error validating space:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/import/start', async (req, res) => {
  try {
    const { sourcePath, destinationPath, strategy, socketId, subframeMode } = req.body;

    if (!sourcePath || !destinationPath || !strategy || !socketId) {
      return res.status(400).json({
        success: false,
        error: 'sourcePath, destinationPath, strategy, and socketId required'
      });
    }

    const importSubframeMode = subframeMode || 'all';
    console.log(`Starting import: ${sourcePath} -> ${destinationPath} (${strategy}, ${importSubframeMode})`);

    // Start import asynchronously (don't await - it's long-running)
    const operationId = Date.now().toString();
    importService.startImport(sourcePath, destinationPath, strategy, socketId, operationId, importSubframeMode)
      .then(() => {
        console.log(`Import completed successfully`);
      })
      .catch(error => {
        console.error(`Import failed:`, error);
        io.to(socketId).emit('import:error', {
          error: error.message,
          operationId
        });
      });

    res.json({ success: true, operationId, message: 'Import started' });
  } catch (error) {
    console.error('Error starting import:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/import/cancel', async (req, res) => {
  try {
    console.log('Cancelling import...');
    const result = await importService.cancelImport();
    console.log(`Import ${result.cancelled ? 'cancelled' : 'not active'}`);
    res.json(result);
  } catch (error) {
    console.error('Error cancelling import:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/import/validate', async (req, res) => {
  try {
    const { sourcePath, destinationPath, socketId, subframeMode = 'all' } = req.body;

    if (!sourcePath || !destinationPath || !socketId) {
      return res.status(400).json({
        success: false,
        error: 'sourcePath, destinationPath, and socketId required'
      });
    }

    const operationId = Date.now().toString();
    console.log(`Starting transfer validation: ${sourcePath} -> ${destinationPath} (subframeMode: ${subframeMode})`);

    // Start validation asynchronously
    importService.validateTransfer(sourcePath, destinationPath, socketId, operationId, subframeMode)
      .catch(error => {
        io.to(socketId).emit('validate:error', {
          error: error.message,
          operationId
        });
      });

    res.json({ success: true, operationId, message: 'Validation started' });
  } catch (error) {
    console.error('Error starting validation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Merge API Routes
app.post('/api/merge/analyze', async (req, res) => {
  try {
    const { sourcePaths, destinationPath, socketId, subframeMode } = req.body;

    if (!sourcePaths || !Array.isArray(sourcePaths) || sourcePaths.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'At least 2 source paths required'
      });
    }

    if (!destinationPath) {
      return res.status(400).json({
        success: false,
        error: 'destinationPath required'
      });
    }

    const mergeSubframeMode = subframeMode || 'all';
    console.log(`Analyzing ${sourcePaths.length} libraries for merge (${mergeSubframeMode})...`);
    const result = await mergeService.analyzeSources(sourcePaths, destinationPath, socketId, mergeSubframeMode);

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error analyzing merge:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/merge/validate-space', async (req, res) => {
  try {
    const { sourcePaths, destinationPath, subframeMode } = req.body;

    if (!sourcePaths || !destinationPath) {
      return res.status(400).json({
        success: false,
        error: 'sourcePaths and destinationPath required'
      });
    }

    const mergeSubframeMode = subframeMode || 'all';
    console.log(`Validating disk space for merge: ${sourcePaths.length} sources (${mergeSubframeMode})`);

    // Calculate deduplicated space required
    const required = await DiskSpaceValidator.getMergeRequiredSpace(sourcePaths, mergeSubframeMode);
    const requiredWithBuffer = Math.ceil(required * 1.1); // 10% buffer

    // Get available space
    const available = await DiskSpaceValidator.getAvailableSpace(destinationPath);

    const result = {
      hasEnoughSpace: available >= requiredWithBuffer,
      required: requiredWithBuffer,
      requiredFormatted: DiskSpaceValidator.formatBytes(requiredWithBuffer),
      available,
      availableFormatted: DiskSpaceValidator.formatBytes(available),
      bufferApplied: 1.1,
      requiredWithoutBuffer: required,
      requiredWithoutBufferFormatted: DiskSpaceValidator.formatBytes(required)
    };

    console.log(`Merge space validation: ${result.hasEnoughSpace ? 'OK' : 'INSUFFICIENT'} - Required: ${result.requiredFormatted}`);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error validating merge space:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/merge/start', async (req, res) => {
  try {
    const { sourcePaths, destinationPath, mergePlan, socketId } = req.body;

    if (!sourcePaths || !destinationPath || !mergePlan || !socketId) {
      return res.status(400).json({
        success: false,
        error: 'sourcePaths, destinationPath, mergePlan, and socketId required'
      });
    }

    console.log(`Starting merge: ${sourcePaths.length} sources -> ${destinationPath}`);

    const operationId = Date.now().toString();
    mergeService.executeMerge(sourcePaths, destinationPath, mergePlan, socketId, operationId)
      .then(() => {
        console.log(`Merge completed successfully`);
      })
      .catch(error => {
        console.error(`Merge failed:`, error);
        io.to(socketId).emit('merge:error', {
          error: error.message,
          operationId
        });
      });

    res.json({ success: true, operationId, message: 'Merge started' });
  } catch (error) {
    console.error('Error starting merge:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/merge/cancel', async (req, res) => {
  try {
    console.log('Cancelling merge...');
    const result = await mergeService.cancelMerge();
    res.json(result);
  } catch (error) {
    console.error('Error cancelling merge:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/merge/validate', async (req, res) => {
  try {
    const { destinationPath, mergePlan, socketId } = req.body;

    if (!destinationPath || !mergePlan || !socketId) {
      return res.status(400).json({
        success: false,
        error: 'destinationPath, mergePlan, and socketId required'
      });
    }

    const operationId = Date.now().toString();
    console.log(`Starting merge validation: ${destinationPath}`);
    console.log(`MergePlan summary: filesToCopy=${mergePlan.filesToCopy?.length || 0}, filesAlreadyExist=${mergePlan.filesAlreadyExist?.length || 0}, uniqueFiles=${mergePlan.uniqueFiles}`);

    mergeService.validateMerge(destinationPath, mergePlan, socketId, operationId)
      .catch(error => {
        io.to(socketId).emit('validate:error', {
          error: error.message,
          operationId
        });
      });

    res.json({ success: true, operationId, message: 'Validation started' });
  } catch (error) {
    console.error('Error starting merge validation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Object Rename ───────────────────────────────────────────────────────────
app.post('/api/rename-object', async (req, res) => {
  try {
    const { libraryPath, fromName, toName } = req.body;

    if (!libraryPath || !fromName || !toName) {
      return res.status(400).json({
        success: false,
        error: 'libraryPath, fromName and toName are required'
      });
    }

    console.log(`Renaming object: "${fromName}" → "${toName}" in ${libraryPath}`);
    const result = await FileRenamer.renameObject(libraryPath, fromName, toName);

    if (result.success) {
      console.log(`Rename complete: ${result.renamedFolders.length} folder(s), ${result.renamedFiles.length} file(s)`);
    } else {
      console.warn(`Rename failed: ${result.errors?.join('; ') || 'unknown error'}`);
    }

    res.json(result);
  } catch (error) {
    console.error('Error during object rename:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Catalog Aliases — SIMBAD TAP service ────────────────────────────────────
// In-memory cache: normalized object name → resolved result (lives for process lifetime)
const aliasCache = new Map();

app.get('/api/catalog/aliases', async (req, res) => {
  // This endpoint requires Online mode
  if (!config.mode.online) {
    return res.json({ success: false, offline: true, aliases: [], message: 'Online mode required' });
  }

  const { name } = req.query;
  if (!name) {
    return res.status(400).json({ success: false, error: 'name parameter required' });
  }

  // Normalize: strip local suffixes only — SIMBAD stores identifiers with spaces ("M 27", "NGC 6853")
  const normalized = name
    .replace(/_(mosaic|sub)\b.*/i, '')
    .trim();

  // Return cached result if available
  if (aliasCache.has(normalized)) {
    return res.json({ success: true, cached: true, ...aliasCache.get(normalized) });
  }

  try {
    // SIMBAD TAP ADQL query: join ident to itself to get all aliases + coordinates
    // Single-quote escaping for ADQL safety
    const safeName = normalized.replace(/'/g, "''");
    const adql = `SELECT b.main_id, id2.id, b.ra, b.dec `
               + `FROM ident AS id1 JOIN ident AS id2 USING(oidref) `
               + `JOIN basic AS b ON b.oid = id1.oidref `
               + `WHERE id1.id = '${safeName}'`;

    const simbadUrl = `https://simbad.cds.unistra.fr/simbad/sim-tap/sync`
                    + `?request=doQuery&lang=adql&format=json`
                    + `&query=${encodeURIComponent(adql)}`;

    const response = await fetch(simbadUrl, { signal: AbortSignal.timeout(10000) });

    if (!response.ok) {
      return res.json({ success: false, error: `SIMBAD returned HTTP ${response.status}`, aliases: [] });
    }

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.warn(`SIMBAD TAP returned non-JSON for "${normalized}": ${text.substring(0, 120)}`);
      return res.json({ success: false, error: 'Unexpected response format from SIMBAD', aliases: [] });
    }

    // SIMBAD TAP JSON format: { metadata: [{name, datatype, ...}], data: [[row values], ...] }
    // Column order matches the SELECT: main_id(0), id(1), ra(2), dec(3)
    const rows = data.data || [];

    if (!rows.length) {
      console.log(`SIMBAD: no result for "${normalized}"`);
      const result = { aliases: [], mainId: null, ra: null, dec: null };
      aliasCache.set(normalized, result);
      return res.json({ success: true, cached: false, notFound: true, ...result });
    }

    const mainId = rows[0][0] || null;
    const ra     = rows[0][2] ?? null;
    const dec    = rows[0][3] ?? null;

    // Collect all raw identifiers from column 1 (deduplicated)
    const seen = new Set();
    const allIds = [];
    for (const row of rows) {
      const id = row[1];
      if (id && !seen.has(id)) { seen.add(id); allIds.push(id); }
    }

    // Curate: keep only the common name + major catalog identifiers
    const aliases = [];

    // Common names — SIMBAD stores these with a "NAME " prefix (there can be several)
    for (const nameEntry of allIds.filter(a => /^NAME\s+/i.test(a))) {
      aliases.push(nameEntry.replace(/^NAME\s+/i, '').trim());
    }

    // Major catalog identifiers in display-priority order
    // Deep-sky: Messier, NGC, IC, Caldwell, Sharpless, Abell, Barnard
    // Stars:    Henry Draper, Hipparcos
    for (const prefix of ['M ', 'NGC ', 'IC ', 'C ', 'Sh ', 'Abell ', 'B ', 'HD ', 'HIP ']) {
      const match = allIds.find(a => a.startsWith(prefix));
      if (match) aliases.push(match);
    }

    const result = { aliases, mainId, ra, dec };
    aliasCache.set(normalized, result);
    console.log(`SIMBAD resolved "${normalized}" (mainId: ${mainId}): ${aliases.length} aliases`);
    res.json({ success: true, cached: false, ...result });
  } catch (error) {
    console.error('SIMBAD TAP query failed:', error.message);
    res.json({ success: false, error: error.message, aliases: [] });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });

  // Will be used for progress updates during file operations
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });
});

// Make io available to route handlers
app.set('io', io);

// Start server
server.listen(PORT, HOST, () => {
  console.log(`╔═══════════════════════════════════════════════════╗`);
  console.log(`║   SSLM - SeeStar Library Manager - Running       ║`);
  console.log(`╠═══════════════════════════════════════════════════╣`);
  console.log(`║  URL:  http://${HOST}:${PORT}                   ║`);
  console.log(`║  Mode: ${config.mode.online ? 'Online ' : 'Offline'}                               ║`);
  console.log(`╚═══════════════════════════════════════════════════╝`);
  console.log(`\nPress Ctrl+C to stop the server\n`);

  // When running as a packaged exe, auto-open the browser after a short delay
  // to ensure the server socket is fully accepting connections first.
  if (isPackaged) {
    const { exec } = require('child_process');
    setTimeout(() => exec(`start http://${HOST}:${PORT}`), 1500);
  }
});

// Quit endpoint — lets the browser trigger a graceful shutdown
app.post('/api/quit', (req, res) => {
  res.json({ message: 'Shutting down...' });
  setTimeout(gracefulShutdown, 200);
});

// Graceful shutdown
const gracefulShutdown = () => {
  console.log('\nShutdown signal received, shutting down gracefully...');

  // Cancel any ongoing operations
  importService.cancelImport().catch(() => { });
  mergeService.cancelMerge().catch(() => { });

  // Close all Socket.IO connections
  io.close(() => {
    console.log('Socket.IO server closed');
  });

  // Close HTTP server
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });

  // Force exit after 5 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 5000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

module.exports = { app, io };
