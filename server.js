const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const fs = require('fs-extra');
const DirectoryBrowser = require('./src/utils/directoryBrowser');
const FileAnalyzer = require('./src/services/fileAnalyzer');
const FileCleanup = require('./src/services/fileCleanup');

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
    paths: { lastSourcePath: '', lastDestinationPath: '' },
    preferences: { defaultImportStrategy: 'incremental' }
  };
}

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
      ...result
    });
  } catch (error) {
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

    console.log(`Analyzing directory: ${directoryPath}`);
    const result = await FileAnalyzer.analyzeDirectory(directoryPath);

    if (result.success) {
      console.log(`Analysis complete: ${result.summary.totalObjects} objects found in ${result.analysisTime}ms`);
    }

    res.json(result);
  } catch (error) {
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
process.on('SIGTERM', () => {
  console.log('\nSIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = { app, io };
