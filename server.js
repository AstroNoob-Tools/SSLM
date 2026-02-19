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

// Create Express app
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Load configuration
const configPath = path.join(__dirname, 'config', 'settings.json');
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
}

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
    const { mainFolderPath, subFolderPath, mainFiles, subFiles } = req.body;

    if (!mainFolderPath || !mainFiles) {
      return res.status(400).json({ success: false, error: 'mainFolderPath and mainFiles are required' });
    }

    const result = await FileCleanup.deleteSessionFiles({
      mainFolderPath,
      subFolderPath,
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
  console.log(`║   SSLM - SeaStar Library Manager - Running       ║`);
  console.log(`╠═══════════════════════════════════════════════════╣`);
  console.log(`║  URL:  http://${HOST}:${PORT}                   ║`);
  console.log(`║  Mode: ${config.mode.online ? 'Online ' : 'Offline'}                               ║`);
  console.log(`╚═══════════════════════════════════════════════════╝`);
  console.log(`\nPress Ctrl+C to stop the server\n`);
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
