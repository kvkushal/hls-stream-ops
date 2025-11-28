const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
require('dotenv').config();

const Stream = require('./models/Stream');
const HLSMonitor = require('./monitor');

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

// Connect to MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

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

// Get all streams
app.get('/api/streams', async (req, res) => {
  try {
    const streams = await Stream.find()
      .select('-metricsHistory -errorHistory')
      .sort({ createdAt: -1 });
    res.json({ streams, count: streams.length });
  } catch (error) {
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

    const monitor = new HLSMonitor(url, stream._id, io, Stream);
    activeMonitors.set(url, monitor);
    await monitor.start();

    res.json({ 
      message: 'Stream added successfully', 
      stream 
    });

  } catch (error) {
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
    res.status(500).json({ error: error.message });
  }
});

// Get metrics history
app.get('/api/streams/:id/history', async (req, res) => {
  try {
    const stream = await Stream.findById(req.params.id)
      .select('metricsHistory errorHistory sprites url name');
    
    if (!stream) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    res.json({ 
      url: stream.url,
      name: stream.name,
      metrics: stream.metricsHistory,
      errors: stream.errorHistory,
      sprites: stream.sprites
    });

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

    await Stream.findByIdAndDelete(req.params.id);

    res.json({ message: 'Stream deleted successfully' });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// WebSocket
io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  activeMonitors.forEach(monitor => monitor.stop());
  server.close(() => {
    mongoose.connection.close();
    process.exit(0);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});