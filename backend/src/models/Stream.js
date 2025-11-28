const mongoose = require('mongoose');

const metricSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  latency: Number,
  bitrate: Number,
  segmentDuration: Number,
  variantCount: Number,
  status: { type: String, enum: ['ok', 'warning', 'error'], default: 'ok' }
}, { _id: false });

const errorSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  message: String,
  type: String,
  severity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' }
}, { _id: false });

const spriteSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  filename: String,
  path: String
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
    bitrate: { type: Number, default: 0 },
    segmentDuration: { type: Number, default: 0 },
    variantCount: { type: Number, default: 0 }
  },
  metricsHistory: [metricSchema],
  errorHistory: [errorSchema],
  sprites: [spriteSchema],
  lastChecked: {
    type: Date,
    default: Date.now
  },
  health: {
    score: { type: Number, default: 100 },
    issues: [String]
  }
}, {
  timestamps: true
});

streamSchema.pre('save', function(next) {
  if (this.metricsHistory.length > 100) {
    this.metricsHistory = this.metricsHistory.slice(-100);
  }
  if (this.errorHistory.length > 50) {
    this.errorHistory = this.errorHistory.slice(-50);
  }
  if (this.sprites.length > 20) {
    this.sprites = this.sprites.slice(-20);
  }
  next();
});

module.exports = mongoose.model('Stream', streamSchema);