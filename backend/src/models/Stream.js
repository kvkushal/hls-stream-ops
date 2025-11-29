const mongoose = require('mongoose');

const metricSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  latency: Number,
  downloadSpeed: Number, // MB/s
  bitrate: Number,
  segmentDuration: Number,
  variantCount: Number,
  ttfb: Number, // Time to first byte
  downloadTime: Number, // seconds
  segmentSize: Number, // bytes
  status: { type: String, enum: ['ok', 'warning', 'error'], default: 'ok' }
}, { _id: false });

const errorSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  message: String,
  type: String,
  severity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  details: String
}, { _id: false });

const spriteSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  filename: String,
  path: String,
  timeCode: String
}, { _id: false });

const variantSchema = new mongoose.Schema({
  resolution: String,
  bandwidth: Number,
  url: String,
  isActive: Boolean
}, { _id: false });

const streamSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'error', 'stopped'],
    default: 'active'
  },
  currentMetrics: {
    latency: { type: Number, default: 0 },
    downloadSpeed: { type: Number, default: 0 },
    bitrate: { type: Number, default: 0 },
    segmentDuration: { type: Number, default: 0 },
    variantCount: { type: Number, default: 0 },
    ttfb: { type: Number, default: 0 }
  },
  variants: [variantSchema],
  metricsHistory: [metricSchema],
  errorHistory: [errorSchema],
  sprites: [spriteSchema],
  lastChecked: {
    type: Date,
    default: Date.now
  },
  health: {
    score: { type: Number, default: 100 },
    issues: [String],
    color: { type: String, enum: ['green', 'yellow', 'red'], default: 'green' }
  },
  lastSpriteUrl: String // Latest sprite for grid view
}, {
  timestamps: true
});

// Keep only last 200 metrics (covers ~30 minutes at 10s intervals)
streamSchema.pre('save', function(next) {
  if (this.metricsHistory.length > 200) {
    this.metricsHistory = this.metricsHistory.slice(-200);
  }
  if (this.errorHistory.length > 100) {
    this.errorHistory = this.errorHistory.slice(-100);
  }
  if (this.sprites.length > 50) {
    this.sprites = this.sprites.slice(-50);
  }
  next();
});

module.exports = mongoose.model('Stream', streamSchema);