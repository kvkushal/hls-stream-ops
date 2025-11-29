const axios = require('axios');
const Parser = require('m3u8-parser');
const SpriteGenerator = require('./spriteGenerator');
const logger = require('./logger');

class HLSMonitor {
  constructor(url, streamId, io, Stream) {
    this.url = url;
    this.streamId = streamId;
    this.io = io;
    this.Stream = Stream;
    this.isRunning = false;
    this.intervalId = null;
    this.consecutiveErrors = 0;
    this.spriteGenerator = new SpriteGenerator();
    this.spriteCounter = 0;
    this.lastManifestUpdate = Date.now();
  }

  async start() {
    this.isRunning = true;
    const stream = await this.Stream.findById(this.streamId);
    logger.streamLog(this.url, stream?.name || 'Unknown', 'Monitor started', 'info');
    
    // Check every 10 seconds
    this.intervalId = setInterval(() => {
      this.checkStream();
    }, 10000);

    // Check immediately
    await this.checkStream();
  }

  async checkStream() {
    const stream = await this.Stream.findById(this.streamId);
    if (!stream) return;

    try {
      const startTime = Date.now();
      const ttfbStart = Date.now();
      
      const response = await axios.get(this.url, {
        timeout: 5000,
        headers: {
          'User-Agent': 'HLS-Monitor/1.0'
        }
      });
      
      const ttfb = Date.now() - ttfbStart;
      const totalLatency = Date.now() - startTime;
      
      // Parse manifest
      const parser = new Parser.Parser();
      parser.push(response.data);
      parser.end();
      
      const manifest = parser.manifest;
      
      // Extract variants
      const variants = this.extractVariants(manifest);
      
      // Calculate download speed (approximate)
      const contentLength = parseInt(response.headers['content-length'] || '0');
      const downloadTime = totalLatency / 1000; // seconds
      const downloadSpeed = contentLength > 0 ? (contentLength / 1024 / 1024) / downloadTime : 0; // MB/s
      
      const metrics = {
        latency: totalLatency,
        downloadSpeed: downloadSpeed,
        ttfb: ttfb,
        downloadTime: downloadTime,
        bitrate: this.calculateBitrate(manifest),
        segmentDuration: manifest.targetDuration || 0,
        variantCount: variants.length,
        segmentSize: contentLength,
        status: this.determineStatus(totalLatency, manifest),
        timestamp: new Date()
      };

      const health = this.calculateHealth(metrics, totalLatency, manifest);

      // Check manifest update (critical error if not updated)
      if (manifest.targetDuration > 0) {
        const timeSinceUpdate = (Date.now() - this.lastManifestUpdate) / 1000;
        if (timeSinceUpdate > (manifest.targetDuration + 6)) {
          logger.streamLog(
            this.url,
            stream.name,
            `CRITICAL: Manifest not updated for ${timeSinceUpdate.toFixed(1)}s`,
            'high',
            { targetDuration: manifest.targetDuration }
          );
          health.color = 'red';
          health.score = Math.min(health.score, 30);
        }
        this.lastManifestUpdate = Date.now();
      }

      // Generate sprite every 3rd check (30 seconds)
      this.spriteCounter++;
      let spriteData = null;
      if (this.spriteCounter % 3 === 0) {
        try {
          spriteData = await this.spriteGenerator.generateSpriteForStream({
            url: this.url,
            _id: this.streamId
          });
          
          if (spriteData) {
            logger.streamLog(this.url, stream.name, 'Sprite generated', 'info', {
              filename: spriteData.filename
            });
          }
        } catch (err) {
          logger.streamLog(this.url, stream.name, 'Sprite generation failed', 'low', {
            error: err.message
          });
        }
      }

      // Log event
      logger.streamLog(
        this.url,
        stream.name,
        'Health check completed',
        metrics.status === 'ok' ? 'info' : metrics.status === 'warning' ? 'medium' : 'high',
        {
          latency: `${metrics.latency}ms`,
          downloadSpeed: `${metrics.downloadSpeed.toFixed(2)}MB/s`,
          bitrate: `${(metrics.bitrate / 1000000).toFixed(2)}Mbps`,
          health: `${health.score}%`
        }
      );

      // Update database
      const updateData = {
        currentMetrics: metrics,
        variants: variants,
        lastChecked: new Date(),
        status: metrics.status === 'error' ? 'error' : 'active',
        health: health,
        $push: {
          metricsHistory: {
            $each: [metrics],
            $slice: -200
          }
        }
      };

      if (spriteData) {
        updateData.lastSpriteUrl = spriteData.path;
        updateData.$push.sprites = {
          $each: [spriteData],
          $slice: -50
        };
      }

      await this.Stream.findByIdAndUpdate(this.streamId, updateData);

      this.consecutiveErrors = 0;

      // Emit via WebSocket
      this.io.emit('metrics', {
        streamId: this.streamId,
        url: this.url,
        metrics: metrics,
        health: health,
        variants: variants,
        sprite: spriteData,
        timestamp: new Date()
      });

    } catch (error) {
      this.consecutiveErrors++;
      
      const errorData = {
        message: error.message,
        timestamp: new Date(),
        type: error.code || 'UNKNOWN',
        severity: this.consecutiveErrors > 3 ? 'high' : 'medium',
        details: error.response?.statusText || ''
      };

      logger.streamLog(
        this.url,
        stream.name,
        `ERROR: ${error.message}`,
        errorData.severity,
        {
          code: error.code,
          consecutiveErrors: this.consecutiveErrors
        }
      );

      await this.Stream.findByIdAndUpdate(this.streamId, {
        status: 'error',
        $push: {
          errorHistory: {
            $each: [errorData],
            $slice: -100
          }
        },
        'health.score': Math.max(0, 100 - (this.consecutiveErrors * 20)),
        'health.color': 'red',
        'health.issues': [error.message]
      });
      
      this.io.emit('stream-error', {
        streamId: this.streamId,
        url: this.url,
        error: errorData
      });
    }
  }

  extractVariants(manifest) {
    if (!manifest.playlists || manifest.playlists.length === 0) {
      return [];
    }

    return manifest.playlists.map(playlist => ({
      resolution: playlist.attributes?.RESOLUTION ? 
        `${playlist.attributes.RESOLUTION.width}x${playlist.attributes.RESOLUTION.height}` : 
        'Unknown',
      bandwidth: playlist.attributes?.BANDWIDTH || 0,
      url: playlist.uri,
      isActive: true
    }));
  }

  calculateBitrate(manifest) {
    if (manifest.playlists && manifest.playlists.length > 0) {
      const bitrates = manifest.playlists
        .map(p => p.attributes?.BANDWIDTH || 0)
        .filter(b => b > 0);
      
      return bitrates.length > 0 ? Math.max(...bitrates) : 0;
    }
    return 0;
  }

  determineStatus(latency, manifest) {
    if (latency > 3000) return 'error';
    if (latency > 1500) return 'warning';
    if (!manifest.playlists || manifest.playlists.length === 0) return 'warning';
    return 'ok';
  }

  calculateHealth(metrics, latency, manifest) {
    let score = 100;
    const issues = [];
    let color = 'green';

    // Latency scoring
    if (latency > 3000) {
      score -= 40;
      issues.push('Critical: Latency > 3s');
      color = 'red';
    } else if (latency > 1500) {
      score -= 20;
      issues.push('Warning: High latency (>1.5s)');
      color = 'yellow';
    } else if (latency > 1000) {
      score -= 10;
      issues.push('Moderate latency (>1s)');
      if (color === 'green') color = 'yellow';
    }

    // Variant check
    if (metrics.variantCount === 0) {
      score -= 30;
      issues.push('No variants found');
      color = 'red';
    }

    // Bitrate check
    if (metrics.bitrate === 0) {
      score -= 20;
      issues.push('Bitrate not detected');
      color = 'red';
    }

    // Buffer warning simulation (would need actual player integration)
    if (metrics.downloadSpeed < 0.5 && metrics.downloadSpeed > 0) {
      score -= 15;
      issues.push('Low download speed');
      if (color === 'green') color = 'yellow';
    }

    return {
      score: Math.max(0, score),
      issues: issues,
      color: color
    };
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.isRunning = false;
      
      this.Stream.findById(this.streamId).then(stream => {
        if (stream) {
          logger.streamLog(this.url, stream.name, 'Monitor stopped', 'info');
        }
      });
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      consecutiveErrors: this.consecutiveErrors
    };
  }
}

module.exports = HLSMonitor;