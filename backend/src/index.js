const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
require('dotenv').config();

const Stream = require('./models/Stream');
const HLSMonitor = require('./monitor');
const logger = require('./logger');
const SpriteGenerator = require('./spriteGenerator');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "DELETE"]
  }
});

const PORT = process.env.BACKEND_PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/hls_monitor';

// Middleware
app.use(cors());
app.use(express.json());
app.use('/sprites', express.static(path.join(__dirname, '../public/sprites')));

// Store active monitors
const activeMonitors = new Map();
const spriteGenerator = new SpriteGenerator();

// Connect to MongoDB
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    logger.log('SYSTEM', 'MongoDB connected', 'info');
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    logger.log('SYSTEM', `MongoDB connection failed: ${err.message}`, 'high');
  });

// Clean old sprites daily
setInterval(() => {
  spriteGenerator.cleanOldSprites();
}, 24 * 60 * 60 * 1000);

// ========== ROUTES ==========

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Backend is running',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    activeStreams: activeMonitors.size,
    uptime: process.uptime()
  });
});

// Get all streams (for grid view)
app.get('/api/streams', async (req, res) => {
  try {
    const streams = await Stream.find()
      .select('name url status currentMetrics health lastSpriteUrl lastChecked createdAt')
      .sort({ createdAt: -1 });
    
    res.json({ 
      streams, 
      count: streams.length 
    });
  } catch (error) {
    logger.log('API', `Error fetching streams: ${error.message}`, 'high');
    res.status(500).json({ error: error.message });
  }
});

// Add stream
app.post('/api/streams', async (req, res) => {
  try {
    const { url, name } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    let stream = await Stream.findOne({ url });
    
    if (stream) {
      return res.status(400).json({ error: 'Stream already exists' });
    }

    stream = new Stream({
      url,
      name: name || url,
      status: 'active'
    });

    await stream.save();

    logger.streamLog(url, name, 'Stream added', 'info');

    const monitor = new HLSMonitor(url, stream._id, io, Stream);
    activeMonitors.set(url, monitor);
    await monitor.start();

    res.json({ 
      message: 'Stream added successfully', 
      stream 
    });

  } catch (error) {
    logger.log('API', `Error adding stream: ${error.message}`, 'high');
    res.status(500).json({ error: error.message });
  }
});

// Get single stream with full details
app.get('/api/streams/:id', async (req, res) => {
  try {
    const stream = await Stream.findById(req.params.id);
    
    if (!stream) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    const monitor = activeMonitors.get(stream.url);
    const monitorStatus = monitor ? monitor.getStatus() : null;

    res.json({ 
      stream,
      monitorStatus
    });

  } catch (error) {
    logger.log('API', `Error fetching stream: ${error.message}`, 'high');
    res.status(500).json({ error: error.message });
  }
});

// Get stream metrics history (for timeline graphs)
app.get('/api/streams/:id/history', async (req, res) => {
  try {
    const { range } = req.query; // 3min, 30min, 3h, 8h, 2d, 4d
    
    const stream = await Stream.findById(req.params.id)
      .select('metricsHistory errorHistory sprites url name variants');
    
    if (!stream) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    // Filter by range
    let filteredMetrics = stream.metricsHistory;
    if (range) {
      const now = Date.now();
      const ranges = {
        '3min': 3 * 60 * 1000,
        '30min': 30 * 60 * 1000,
        '3h': 3 * 60 * 60 * 1000,
        '8h': 8 * 60 * 60 * 1000,
        '2d': 2 * 24 * 60 * 60 * 1000,
        '4d': 4 * 24 * 60 * 60 * 1000
      };
      
      const cutoff = now - (ranges[range] || ranges['30min']);
      filteredMetrics = stream.metricsHistory.filter(m => 
        new Date(m.timestamp).getTime() > cutoff
      );
    }

    res.json({ 
      url: stream.url,
      name: stream.name,
      variants: stream.variants,
      metrics: filteredMetrics,
      errors: stream.errorHistory,
      sprites: stream.sprites
    });

  } catch (error) {
    logger.log('API', `Error fetching history: ${error.message}`, 'high');
    res.status(500).json({ error: error.message });
  }
});

// Get logs for a specific date
app.get('/api/logs/:date', (req, res) => {
  try {
    const { date } = req.params;
    const logs = logger.getLogFile(date);
    
    if (!logs) {
      return res.status(404).json({ error: 'Log file not found' });
    }

    res.type('text/plain');
    res.send(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get recent logs (last N lines)
app.get('/api/logs/recent/:lines?', (req, res) => {
  try {
    const lines = parseInt(req.params.lines) || 100;
    const logs = logger.getRecentLogs(lines);
    
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get logs for specific stream
app.get('/api/streams/:id/logs', async (req, res) => {
  try {
    const stream = await Stream.findById(req.params.id);
    if (!stream) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    const allLogs = logger.getRecentLogs(500);
    const streamLogs = allLogs.filter(log => 
      log.includes(stream.name) || log.includes(stream.url)
    );

    res.json({ logs: streamLogs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete stream
app.delete('/api/streams/:id', async (req, res) => {
  try {
    const stream = await Stream.findById(req.params.id);
    
    if (!stream) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    const monitor = activeMonitors.get(stream.url);
    if (monitor) {
      monitor.stop();
      activeMonitors.delete(stream.url);
    }

    logger.streamLog(stream.url, stream.name, 'Stream deleted', 'info');

    await Stream.findByIdAndDelete(req.params.id);

    res.json({ message: 'Stream deleted successfully' });

  } catch (error) {
    logger.log('API', `Error deleting stream: ${error.message}`, 'high');
    res.status(500).json({ error: error.message });
  }
});

// WebSocket
io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);
  logger.log('WEBSOCKET', `Client connected: ${socket.id}`, 'info');

  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
    logger.log('WEBSOCKET', `Client disconnected: ${socket.id}`, 'info');
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  logger.log('SYSTEM', 'Server shutting down', 'info');
  activeMonitors.forEach(monitor => monitor.stop());
  server.close(() => {
    mongoose.connection.close();
    process.exit(0);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend running on port ${PORT}`);
  logger.log('SYSTEM', `Server started on port ${PORT}`, 'info');
});