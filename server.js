const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const os = require('os');
const fs = require('fs-extra');
const DirectoryBrowser = require('./src/utils/directoryBrowser');
const FileAnalyzer = require('./src/services/fileAnalyzer');
const FileCleanup = require('./src/services/fileCleanup');
const ImportService = require('./src/services/importService');
const MergeService = require('./src/services/mergeService');
const StackExportService = require('./src/services/stackExportService');
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

// Compare two version strings (e.g. "1.0.0-beta.4").
// Returns 1 if a > b, -1 if a < b, 0 if equal.
function compareVersions(a, b) {
  const parse = v => v.replace(/^v/, '').split(/[.\-]/).map(s => isNaN(s) ? s : Number(s));
  const pa = parse(a), pb = parse(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i], y = pb[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (typeof x === 'number' && typeof y === 'number') {
      if (x !== y) return x > y ? 1 : -1;
    } else {
      const xs = String(x), ys = String(y);
      if (xs !== ys) return xs > ys ? 1 : -1;
    }
  }
  return 0;
}

// Session-level cache for update check result (one GitHub API call per server run)
let updateCheckCache = null;

// Create Express app
const app = express();
// HTTP is intentional — this server listens on localhost only and is never exposed
// to a network, so HTTPS/TLS provides no meaningful security benefit here.
const server = http.createServer(app);
const io = socketIO(server);

// Load configuration
// When packaged, store user config in %APPDATA%\SSLM (writable).
// In development, use the local config/ directory.
const configDir = isPackaged
  ? path.join(process.env.APPDATA || process.env.HOME || '.', 'SSLM')
  : path.join(__dirname, 'config');
const configPath = path.join(configDir, 'settings.json');
const operationStatePath = path.join(configDir, 'last-operation.json');
let config = {};

// Write/clear/read a small JSON file that tracks the currently-running operation.
// On the next startup the presence of this file indicates the previous run was
// interrupted (crash, power loss) before the operation could finish cleanly.
function writeOperationState(state) {
  try {
    fs.ensureDirSync(configDir);
    fs.writeJSONSync(operationStatePath, { ...state, startedAt: new Date().toISOString() }, { spaces: 2 });
  } catch (err) {
    console.warn('Could not write operation state:', err.message);
  }
}
function clearOperationState() {
  try { fs.removeSync(operationStatePath); } catch (_) { }
}
function readOperationState() {
  try { return fs.readJSONSync(operationStatePath); } catch (_) { return null; }
}

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

// Check for an operation that was interrupted by a crash or unexpected shutdown.
// If last-operation.json exists at startup it was never cleared by a clean finish.
const interruptedOperation = readOperationState();
if (interruptedOperation) {
  console.warn(`[STARTUP] Interrupted operation detected: ${interruptedOperation.type} started at ${interruptedOperation.startedAt}`);
}

// Initialize services with Socket.IO and config
const importService = new ImportService(io, config);
const mergeService = new MergeService(io, config);
const stackExportService = new StackExportService(io, config);

const PORT = process.env.PORT || config.server.port || 3000;
const HOST = config.server.host || 'localhost';

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.disable('x-powered-by'); // Do not advertise the framework in response headers

// Simple in-memory rate limiter for expensive endpoints (CWE-770)
// windowMs: rolling window length; max: max requests per window per IP
function createRateLimiter({ windowMs = 60_000, max = 10 } = {}) {
  const hits = new Map(); // ip -> [timestamps]

  // Periodically evict entries whose timestamps have all expired, bounding Map growth (CWE-770)
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of hits.entries()) {
      if (timestamps.every(t => now - t >= windowMs)) {
        hits.delete(ip);
      }
    }
  }, windowMs * 2);
  cleanupTimer.unref(); // Don't prevent process exit

  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const window = (hits.get(ip) || []).filter(t => now - t < windowMs);
    if (window.length >= max) {
      return res.status(429).json({ success: false, error: 'Too many requests, please try again later.' });
    }
    window.push(now);
    hits.set(ip, window);
    next();
  };
}

// Rate limiters for expensive file-system operations
const heavyOpLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });   // import/merge start
const analysisLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });   // analyze / space checks
const lightLimiter = createRateLimiter({ windowMs: 60_000, max: 200 });  // static pages / image serving

// Path allowlist — rejects any path that does not resolve to a recognised Windows root.
// Allows any drive letter (A-Z:\) and UNC paths (\\server\share) so the user can
// browse and operate on any drive they have authorised, while blocking anything that
// resolves outside a real Windows filesystem root (CWE-22).
function isAllowedPath(resolvedPath) {
  if (!path.isAbsolute(resolvedPath)) return false;
  if (/^[A-Za-z]:[/\\]/.test(resolvedPath)) return true;   // drive-letter root
  if (resolvedPath.startsWith('\\\\')) return true;         // UNC / network path
  return false;
}


// Routes
app.get('/', lightLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/status', lightLimiter, (req, res) => {
  res.json({
    status: 'running',
    version: '1.0.0',
    mode: config.mode.online ? 'online' : 'offline',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/config', lightLimiter, (req, res) => {
  res.json({
    version: APP_VERSION,
    mode: config.mode,
    preferences: config.preferences,
    seestar: config.seestar,
    interruptedOperation: interruptedOperation || null,
    paths: {
      hasLastSource: !!config.paths.lastSourcePath,
      hasLastDestination: !!config.paths.lastDestinationPath
    }
  });
});

app.post('/api/config', analysisLimiter, async (req, res) => {
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
app.get('/api/image', lightLimiter, async (req, res) => {
  try {
    const imagePath = req.query.path;

    if (!imagePath || typeof imagePath !== 'string') {
      return res.status(400).json({ success: false, error: 'Image path is required' });
    }

    // Resolve then allowlist-check to prevent traversal (CWE-22)
    const resolvedPath = path.resolve(imagePath);
    if (!isAllowedPath(resolvedPath)) {
      return res.status(400).json({ success: false, error: 'Invalid image path' });
    }

    // Only serve explicitly allowed image extensions — no fallback to arbitrary files
    const ext = path.extname(resolvedPath).toLowerCase();
    const contentTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.tif': 'image/tiff',
      '.tiff': 'image/tiff'
    };

    const contentType = contentTypes[ext];
    if (!contentType) {
      return res.status(400).json({ success: false, error: 'File type not allowed' });
    }

    // Check if file exists
    const exists = await fs.pathExists(resolvedPath);
    if (!exists) {
      return res.status(404).json({ success: false, error: 'Image not found' });
    }

    // Send file using absolute resolved path
    res.setHeader('Content-Type', contentType);
    res.sendFile(resolvedPath);
  } catch (error) {
    console.error('Error serving image:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Favorites API Routes
app.get('/api/favorites', lightLimiter, (req, res) => {
  try {
    const favorites = config.favorites || [];
    res.json({ success: true, favorites });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/favorites/add', analysisLimiter, async (req, res) => {
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

app.post('/api/favorites/remove', analysisLimiter, async (req, res) => {
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
app.get('/api/browse/drives', lightLimiter, async (req, res) => {
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

app.get('/api/browse/directory', analysisLimiter, async (req, res) => {
  try {
    const rawPath = req.query.path;
    if (!rawPath || typeof rawPath !== 'string') {
      return res.status(400).json({ success: false, error: 'Path parameter required' });
    }
    const directoryPath = path.resolve(rawPath);
    if (!isAllowedPath(directoryPath)) {
      return res.status(400).json({ success: false, error: 'Invalid path' });
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

app.post('/api/browse/create-directory', analysisLimiter, async (req, res) => {
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

app.get('/api/browse/validate', analysisLimiter, async (req, res) => {
  try {
    const { path: rawValidatePath, checkMyWork } = req.query;

    if (!rawValidatePath || typeof rawValidatePath !== 'string') {
      return res.status(400).json({ success: false, error: 'Path parameter required' });
    }
    const directoryPath = path.resolve(rawValidatePath);
    if (!isAllowedPath(directoryPath)) {
      return res.status(400).json({ success: false, error: 'Invalid path' });
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
app.get('/api/analyze', analysisLimiter, async (req, res) => {
  try {
    const rawPath = req.query.path;
    if (!rawPath || typeof rawPath !== 'string') {
      return res.status(400).json({ success: false, error: 'Path parameter required' });
    }
    const directoryPath = path.resolve(rawPath);
    if (!isAllowedPath(directoryPath)) {
      return res.status(400).json({ success: false, error: 'Invalid path' });
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

app.get('/api/analyze/cleanup-suggestions', analysisLimiter, async (req, res) => {
  try {
    const rawPath = req.query.path;
    if (!rawPath || typeof rawPath !== 'string') {
      return res.status(400).json({ success: false, error: 'Path parameter required' });
    }
    const directoryPath = path.resolve(rawPath);
    if (!isAllowedPath(directoryPath)) {
      return res.status(400).json({ success: false, error: 'Invalid path' });
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
app.post('/api/cleanup/empty-directories', heavyOpLimiter, async (req, res) => {
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

app.post('/api/cleanup/subframe-directories', heavyOpLimiter, async (req, res) => {
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

app.get('/api/cleanup/subframe-info', analysisLimiter, async (req, res) => {
  try {
    const rawPath = req.query.path;
    if (!rawPath || typeof rawPath !== 'string') {
      return res.status(400).json({ success: false, error: 'Path parameter required' });
    }
    const directoryPath = path.resolve(rawPath);
    if (!isAllowedPath(directoryPath)) {
      return res.status(400).json({ success: false, error: 'Invalid path' });
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
app.post('/api/cleanup/session', heavyOpLimiter, async (req, res) => {
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
app.get('/api/import/detect-seestar', analysisLimiter, async (req, res) => {
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

app.post('/api/import/validate-space', analysisLimiter, async (req, res) => {
  try {
    const { strategy, subframeMode } = req.body;
    const rawSource = req.body.sourcePath;
    const rawDest = req.body.destinationPath;
    if (!rawSource || typeof rawSource !== 'string' || !rawDest || typeof rawDest !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'sourcePath and destinationPath required'
      });
    }
    const sourcePath = path.resolve(rawSource);
    const destinationPath = path.resolve(rawDest);
    if (!isAllowedPath(sourcePath) || !isAllowedPath(destinationPath)) {
      return res.status(400).json({ success: false, error: 'Invalid path' });
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

app.post('/api/import/start', heavyOpLimiter, async (req, res) => {
  try {
    const { strategy, socketId, subframeMode } = req.body;
    const rawSource = req.body.sourcePath;
    const rawDest = req.body.destinationPath;
    if (!rawSource || typeof rawSource !== 'string' || !rawDest || typeof rawDest !== 'string' ||
      !strategy || !socketId) {
      return res.status(400).json({
        success: false,
        error: 'sourcePath, destinationPath, strategy, and socketId required'
      });
    }
    const sourcePath = path.resolve(rawSource);
    const destinationPath = path.resolve(rawDest);
    if (!isAllowedPath(sourcePath) || !isAllowedPath(destinationPath)) {
      return res.status(400).json({ success: false, error: 'Invalid path' });
    }

    const importSubframeMode = subframeMode || 'all';
    console.log(`Starting import: ${sourcePath} -> ${destinationPath} (${strategy}, ${importSubframeMode})`);

    // Start import asynchronously (don't await - it's long-running)
    const operationId = Date.now().toString();
    writeOperationState({ type: 'import', sourcePath, destinationPath, strategy, operationId });
    importService.startImport(sourcePath, destinationPath, strategy, socketId, operationId, importSubframeMode)
      .then(() => {
        clearOperationState();
        console.log(`Import completed successfully`);
      })
      .catch(error => {
        clearOperationState();
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

app.post('/api/import/cancel', lightLimiter, async (req, res) => {
  try {
    console.log('Cancelling import...');
    const result = await importService.cancelImport();
    clearOperationState();
    console.log(`Import ${result.cancelled ? 'cancelled' : 'not active'}`);
    res.json(result);
  } catch (error) {
    console.error('Error cancelling import:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/import/validate', analysisLimiter, async (req, res) => {
  try {
    const { socketId, subframeMode = 'all' } = req.body;
    const rawSource = req.body.sourcePath;
    const rawDest = req.body.destinationPath;
    if (!rawSource || typeof rawSource !== 'string' || !rawDest || typeof rawDest !== 'string' ||
      !socketId) {
      return res.status(400).json({
        success: false,
        error: 'sourcePath, destinationPath, and socketId required'
      });
    }
    const sourcePath = path.resolve(rawSource);
    const destinationPath = path.resolve(rawDest);
    if (!isAllowedPath(sourcePath) || !isAllowedPath(destinationPath)) {
      return res.status(400).json({ success: false, error: 'Invalid path' });
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
app.post('/api/merge/analyze', analysisLimiter, async (req, res) => {
  try {
    const { socketId, subframeMode } = req.body;
    const sourcePaths = (Array.isArray(req.body.sourcePaths) ? req.body.sourcePaths : [])
      .filter(p => p && typeof p === 'string')
      .map(p => path.resolve(p))
      .filter(p => isAllowedPath(p));
    const rawDest = req.body.destinationPath;

    if (!sourcePaths.length || sourcePaths.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'At least 2 source paths required'
      });
    }

    if (!rawDest || typeof rawDest !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'destinationPath required'
      });
    }
    const destinationPath = path.resolve(rawDest);
    if (!isAllowedPath(destinationPath)) {
      return res.status(400).json({ success: false, error: 'Invalid destinationPath' });
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

app.post('/api/merge/validate-space', analysisLimiter, async (req, res) => {
  try {
    const { subframeMode } = req.body;
    const sourcePaths = (Array.isArray(req.body.sourcePaths) ? req.body.sourcePaths : [])
      .filter(p => typeof p === 'string')
      .map(p => path.resolve(p))
      .filter(p => isAllowedPath(p));
    const rawDest = req.body.destinationPath;
    if (!sourcePaths.length || !rawDest || typeof rawDest !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'sourcePaths and destinationPath required'
      });
    }
    const destinationPath = path.resolve(rawDest);
    if (!isAllowedPath(destinationPath)) {
      return res.status(400).json({ success: false, error: 'Invalid destinationPath' });
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

app.post('/api/merge/start', heavyOpLimiter, async (req, res) => {
  try {
    const { mergePlan, socketId } = req.body;
    const sourcePaths = (Array.isArray(req.body.sourcePaths) ? req.body.sourcePaths : [])
      .filter(p => p && typeof p === 'string')
      .map(p => path.resolve(p))
      .filter(p => isAllowedPath(p));
    const rawDest = req.body.destinationPath;

    if (!sourcePaths.length || !rawDest || typeof rawDest !== 'string' ||
      !mergePlan || !socketId) {
      return res.status(400).json({
        success: false,
        error: 'sourcePaths, destinationPath, mergePlan, and socketId required'
      });
    }
    const destinationPath = path.resolve(rawDest);
    if (!isAllowedPath(destinationPath)) {
      return res.status(400).json({ success: false, error: 'Invalid destinationPath' });
    }

    console.log(`Starting merge: ${sourcePaths.length} sources -> ${destinationPath}`);

    // Sanitize paths nested inside mergePlan.filesToCopy (CWE-22).
    // sourcePath must resolve to a recognised Windows root; relativePath must not
    // contain traversal sequences (it is joined with destinationPath server-side).
    if (Array.isArray(mergePlan.filesToCopy)) {
      mergePlan.filesToCopy = mergePlan.filesToCopy.map(item => {
        if (!item.sourcePath || typeof item.sourcePath !== 'string') return null;
        const resolvedSource = path.resolve(item.sourcePath);
        if (!isAllowedPath(resolvedSource)) return null;
        if (item.relativePath !== undefined) {
          if (typeof item.relativePath !== 'string' || item.relativePath.includes('..')) return null;
        }
        return { ...item, sourcePath: resolvedSource };
      }).filter(Boolean);
    }

    const operationId = Date.now().toString();
    writeOperationState({ type: 'merge', sourcePaths, destinationPath, operationId });
    mergeService.executeMerge(sourcePaths, destinationPath, mergePlan, socketId, operationId)
      .then(() => {
        clearOperationState();
        console.log(`Merge completed successfully`);
      })
      .catch(error => {
        clearOperationState();
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

app.post('/api/merge/cancel', lightLimiter, async (req, res) => {
  try {
    console.log('Cancelling merge...');
    const result = await mergeService.cancelMerge();
    clearOperationState();
    res.json(result);
  } catch (error) {
    console.error('Error cancelling merge:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/merge/validate', analysisLimiter, async (req, res) => {
  try {
    const { mergePlan, socketId } = req.body;
    const rawDest = req.body.destinationPath;
    if (!rawDest || typeof rawDest !== 'string' || !mergePlan || !socketId) {
      return res.status(400).json({
        success: false,
        error: 'destinationPath, mergePlan, and socketId required'
      });
    }
    const destinationPath = path.resolve(rawDest);
    if (!isAllowedPath(destinationPath)) {
      return res.status(400).json({ success: false, error: 'Invalid destinationPath' });
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

// ─── Stack Export API ─────────────────────────────────────────────────────────

/** Scan sub-folders and return totals + space check, without copying anything. */
app.post('/api/export/stack/scan', analysisLimiter, async (req, res) => {
  try {
    const { objectName } = req.body;
    const rawDest = req.body.destinationPath;
    const subFolderPaths = (Array.isArray(req.body.subFolderPaths) ? req.body.subFolderPaths : [])
      .filter(p => p && typeof p === 'string')
      .map(p => path.resolve(p))
      .filter(p => isAllowedPath(p));

    if (!objectName || !rawDest || typeof rawDest !== 'string' || !subFolderPaths.length) {
      return res.status(400).json({
        success: false,
        error: 'objectName, subFolderPaths, and destinationPath are required'
      });
    }
    const destinationPath = path.resolve(rawDest);
    if (!isAllowedPath(destinationPath)) {
      return res.status(400).json({ success: false, error: 'Invalid destinationPath' });
    }

    const result = await stackExportService.scanForExport(subFolderPaths, objectName, destinationPath);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Stack export scan error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Start the stack export (async — progress via Socket.IO). */
app.post('/api/export/stack', heavyOpLimiter, async (req, res) => {
  try {
    const { objectName, socketId } = req.body;
    const rawDest = req.body.destinationPath;
    const subFolderPaths = (Array.isArray(req.body.subFolderPaths) ? req.body.subFolderPaths : [])
      .filter(p => p && typeof p === 'string')
      .map(p => path.resolve(p))
      .filter(p => isAllowedPath(p));

    if (!objectName || !rawDest || typeof rawDest !== 'string' || !socketId || !subFolderPaths.length) {
      return res.status(400).json({
        success: false,
        error: 'objectName, subFolderPaths, destinationPath, and socketId are required'
      });
    }
    const destinationPath = path.resolve(rawDest);
    if (!isAllowedPath(destinationPath)) {
      return res.status(400).json({ success: false, error: 'Invalid destinationPath' });
    }

    const operationId = Date.now().toString();
    console.log(`Starting stack export: "${objectName}" → ${destinationPath}`);
    writeOperationState({ type: 'stackexport', objectName, destinationPath, operationId });

    stackExportService.exportToStacking(objectName, subFolderPaths, destinationPath, socketId, operationId)
      .then(() => { clearOperationState(); })
      .catch(error => {
        clearOperationState();
        io.to(socketId).emit('stackexport:error', { error: error.message, operationId });
      });

    res.json({ success: true, operationId });
  } catch (error) {
    console.error('Stack export start error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Cancel an in-progress stack export. */
app.post('/api/export/stack/cancel', lightLimiter, async (req, res) => {
  try {
    const result = await stackExportService.cancelExport();
    clearOperationState();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Validate the exported files against the manifest returned on completion. */
app.post('/api/export/stack/validate', heavyOpLimiter, async (req, res) => {
  try {
    const { socketId } = req.body;
    const manifest = Array.isArray(req.body.manifest) ? req.body.manifest : [];

    if (!socketId || !manifest.length) {
      return res.status(400).json({ success: false, error: 'socketId and manifest are required' });
    }

    // Validate each path in the manifest is on an allowed Windows root
    const validatedManifest = manifest
      .filter(e => e && typeof e.sourcePath === 'string' && typeof e.destPath === 'string')
      .filter(e => isAllowedPath(path.resolve(e.sourcePath)) && isAllowedPath(path.resolve(e.destPath)))
      .map(e => ({ sourcePath: path.resolve(e.sourcePath), destPath: path.resolve(e.destPath), size: e.size }));

    if (!validatedManifest.length) {
      return res.status(400).json({ success: false, error: 'No valid manifest entries' });
    }

    const operationId = Date.now().toString();

    stackExportService.validateExport(validatedManifest, socketId, operationId)
      .catch(error => {
        io.to(socketId).emit('validate:error', { error: error.message, operationId });
      });

    res.json({ success: true, operationId });
  } catch (error) {
    console.error('Stack export validate error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Object Rename ───────────────────────────────────────────────────────────
app.post('/api/rename-object', heavyOpLimiter, async (req, res) => {
  try {
    const { fromName, toName } = req.body;
    const rawLib = req.body.libraryPath;
    if (!rawLib || typeof rawLib !== 'string' || !fromName || !toName) {
      return res.status(400).json({
        success: false,
        error: 'libraryPath, fromName and toName are required'
      });
    }
    const libraryPath = path.resolve(rawLib);
    if (!isAllowedPath(libraryPath)) {
      return res.status(400).json({ success: false, error: 'Invalid libraryPath' });
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

app.get('/api/catalog/aliases', analysisLimiter, async (req, res) => {
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
    const ra = rows[0][2] ?? null;
    const dec = rows[0][3] ?? null;

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

// POST /api/open-url — open a whitelisted URL in the system browser (Windows only)
app.post('/api/open-url', lightLimiter, (req, res) => {
  const { url } = req.body || {};
  const allowed = /^https:\/\/(github\.com|buymeacoffee\.com)\//;
  if (!url || !allowed.test(url)) {
    return res.status(400).json({ error: 'URL not allowed' });
  }
  const { exec } = require('child_process');
  exec(`start "" "${url.replace(/"/g, '')}"`);
  res.json({ success: true });
});

// ── Update endpoints ──────────────────────────────────────────────────────────

// GET /api/update/check — check GitHub Releases for a newer version
app.get('/api/update/check', lightLimiter, async (req, res) => {
  if (updateCheckCache) return res.json(updateCheckCache);

  try {
    const response = await fetch(
      'https://api.github.com/repos/AstroNoob-Tools/SSLM/releases',
      {
        headers: { 'User-Agent': 'SSLM-App' },
        signal: AbortSignal.timeout(8000)
      }
    );
    if (!response.ok) {
      return res.json({ hasUpdate: false, error: `GitHub API returned ${response.status}` });
    }
    const releases = await response.json();
    if (!Array.isArray(releases) || releases.length === 0) {
      return res.json({ hasUpdate: false, error: 'No releases found' });
    }
    const latest = releases[0];
    const latestVersion = latest.tag_name.replace(/^v/, '');
    const asset = (latest.assets || []).find(
      a => a.name.startsWith('SSLM-Setup-') && a.name.endsWith('.exe')
    );
    const hasUpdate = compareVersions(latestVersion, APP_VERSION) > 0;
    updateCheckCache = {
      hasUpdate,
      currentVersion: APP_VERSION,
      latestVersion,
      downloadUrl: asset ? asset.browser_download_url : null,
      fileName: asset ? asset.name : null,
      releaseUrl: latest.html_url
    };
    res.json(updateCheckCache);
  } catch (err) {
    console.warn('Update check failed:', err.message);
    res.json({ hasUpdate: false, error: err.message });
  }
});

// POST /api/update/download — stream installer to %TEMP%, emit Socket.IO progress
app.post('/api/update/download', heavyOpLimiter, async (req, res) => {
  const { downloadUrl, fileName, socketId } = req.body || {};

  // Security: validate inputs
  const validUrl = /^https:\/\/(github\.com|objects\.githubusercontent\.com)\//;
  const validName = /^SSLM-Setup-[\w.\-]+\.exe$/;
  if (!downloadUrl || !validUrl.test(downloadUrl)) {
    return res.status(400).json({ error: 'Invalid download URL' });
  }
  if (!fileName || !validName.test(fileName)) {
    return res.status(400).json({ error: 'Invalid file name' });
  }

  const destPath = path.join(os.tmpdir(), fileName);
  const socket = socketId ? io.sockets.sockets.get(socketId) : null;
  let lastEmit = 0;

  try {
    const response = await fetch(downloadUrl, { signal: AbortSignal.timeout(120000) });
    if (!response.ok) {
      return res.status(502).json({ error: `Download failed: HTTP ${response.status}` });
    }
    const totalBytes = parseInt(response.headers.get('content-length') || '0', 10);
    let bytesDownloaded = 0;

    const fileStream = fs.createWriteStream(destPath);
    const reader = response.body.getReader();

    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fileStream.write(Buffer.from(value));
        bytesDownloaded += value.length;
        const now = Date.now();
        if (socket && now - lastEmit > 500) {
          lastEmit = now;
          socket.emit('update:progress', {
            bytesDownloaded,
            totalBytes,
            percent: totalBytes ? Math.round((bytesDownloaded / totalBytes) * 100) : 0
          });
        }
      }
    };

    await pump();
    await new Promise((resolve, reject) => fileStream.end(err => err ? reject(err) : resolve()));

    if (socket) socket.emit('update:complete', { filePath: destPath });
    res.json({ success: true, filePath: destPath });
  } catch (err) {
    console.error('Update download failed:', err.message);
    if (socket) socket.emit('update:error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/update/install — launch the downloaded installer then quit
app.post('/api/update/install', lightLimiter, (req, res) => {
  const { filePath } = req.body || {};

  // Security: must be inside %TEMP% and match installer name pattern
  const tmpDir = os.tmpdir();
  const validName = /^SSLM-Setup-[\w.\-]+\.exe$/;
  if (
    !filePath ||
    !path.resolve(filePath).startsWith(path.resolve(tmpDir)) ||
    !validName.test(path.basename(filePath))
  ) {
    return res.status(400).json({ error: 'Invalid installer path' });
  }

  res.json({ message: 'Launching installer and shutting down...' });
  const { exec } = require('child_process');
  setTimeout(() => {
    exec(`start "" "${filePath}"`);
    setTimeout(gracefulShutdown, 500);
  }, 300);
});

// Quit endpoint — lets the browser trigger a graceful shutdown
app.post('/api/quit', lightLimiter, (req, res) => {
  res.json({ message: 'Shutting down...' });
  setTimeout(gracefulShutdown, 200);
});

// Graceful shutdown
const gracefulShutdown = () => {
  console.log('\nShutdown signal received, shutting down gracefully...');

  // Cancel any ongoing operations
  importService.cancelImport().catch(() => { });
  mergeService.cancelMerge().catch(() => { });
  stackExportService.cancelExport().catch(() => { });

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

// Global error handlers — prevent silent crashes on unhandled async errors
process.on('unhandledRejection', (reason) => {
  console.error(`[${new Date().toISOString()}] Unhandled Promise Rejection:`, reason);
});
process.on('uncaughtException', (err) => {
  console.error(`[${new Date().toISOString()}] Uncaught Exception:`, err);
  gracefulShutdown();
});

module.exports = { app, io };
