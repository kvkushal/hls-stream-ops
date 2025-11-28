const axios = require('axios');
const Parser = require('m3u8-parser');
const SpriteGenerator = require('./spriteGenerator');

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
  }

  async start() {
    this.isRunning = true;
    console.log(`✅ Starting monitor for: ${this.url}`);
    
    // Check every 10 seconds
    this.intervalId = setInterval(() => {
      this.checkStream();
    }, 10000);

    // Check immediately
    await this.checkStream();
  }

  async checkStream() {
    try {
      const startTime = Date.now();
      
      const response = await axios.get(this.url, {
        timeout: 5000,
        headers: {
          'User-Agent': 'HLS-Monitor/1.0'
        }
      });
      
      const latency = Date.now() - startTime;
      
      const parser = new Parser.Parser();
      parser.push(response.data);
      parser.end();
      
      const manifest = parser.manifest;
      
      const metrics = {
        latency: latency,
        bitrate: this.calculateBitrate(manifest),
        segmentDuration: manifest.targetDuration || 0,
        variantCount: manifest.playlists?.length || 0,
        status: this.determineStatus(latency, manifest),
        timestamp: new Date()
      };

      const health = this.calculateHealth(metrics, latency);

      // Generate sprite every 30 seconds (every 3rd check)
      this.spriteCounter++;
      let spriteData = null;
      if (this.spriteCounter % 3 === 0) {
        try {
          spriteData = await this.spriteGenerator.generateSpriteForStream({
            url: this.url,
            _id: this.streamId
          });
        } catch (err) {
          console.log('Sprite generation skipped:', err.message);
        }
      }

      // Update database
      const updateData = {
        currentMetrics: metrics,
        lastChecked: new Date(),
        status: metrics.status === 'error' ? 'error' : 'active',
        health: health,
        $push: {
          metricsHistory: {
            $each: [metrics],
            $slice: -100
          }
        }
      };

      if (spriteData) {
        updateData.$push.sprites = {
          $each: [spriteData],
          $slice: -20
        };
      }

      await this.Stream.findByIdAndUpdate(this.streamId, updateData);

      this.consecutiveErrors = 0;

      this.io.emit('metrics', {
        streamId: this.streamId,
        url: this.url,
        metrics: metrics,
        health: health,
        sprite: spriteData,
        timestamp: new Date()
      });

      console.log(`✅ [${this.url}] Latency: ${latency}ms, Status: ${metrics.status}, Health: ${health.score}%`);

    } catch (error) {
      this.consecutiveErrors++;
      console.error(`❌ Error monitoring ${this.url}:`, error.message);
      
      const errorData = {
        message: error.message,
        timestamp: new Date(),
        type: error.code || 'UNKNOWN',
        severity: this.consecutiveErrors > 3 ? 'high' : 'medium'
      };

      await this.Stream.findByIdAndUpdate(this.streamId, {
        status: 'error',
        $push: {
          errorHistory: {
            $each: [errorData],
            $slice: -50
          }
        },
        'health.score': Math.max(0, 100 - (this.consecutiveErrors * 20)),
        'health.issues': [error.message]
      });
      
      this.io.emit('stream-error', {
        streamId: this.streamId,
        url: this.url,
        error: errorData
      });
    }
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

  calculateHealth(metrics, latency) {
    let score = 100;
    const issues = [];

    if (latency > 3000) {
      score -= 40;
      issues.push('Very high latency (>3s)');
    } else if (latency > 1500) {
      score -= 20;
      issues.push('High latency (>1.5s)');
    } else if (latency > 1000) {
      score -= 10;
      issues.push('Moderate latency (>1s)');
    }

    if (metrics.variantCount === 0) {
      score -= 30;
      issues.push('No variants found');
    }

    if (metrics.bitrate === 0) {
      score -= 20;
      issues.push('Bitrate not detected');
    }

    return {
      score: Math.max(0, score),
      issues: issues
    };
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.isRunning = false;
      console.log(`⏹️  Stopped monitor for: ${this.url}`);
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