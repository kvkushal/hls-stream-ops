const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

class SpriteGenerator {
  constructor() {
    this.spritesDir = path.join(__dirname, '../public/sprites');
    this.ensureSpritesDir();
  }

  ensureSpritesDir() {
    if (!fs.existsSync(this.spritesDir)) {
      fs.mkdirSync(this.spritesDir, { recursive: true });
    }
  }

  async generateSprite(streamUrl, streamId) {
    return new Promise((resolve, reject) => {
      const timestamp = Date.now();
      const filename = `sprite_${streamId}_${timestamp}.jpg`;
      const outputPath = path.join(this.spritesDir, filename);

      // Try multiple methods to generate sprite
      this.tryGenerateSprite(streamUrl, outputPath)
        .then(() => {
          const timeCode = new Date(timestamp).toISOString().substr(11, 8);
          resolve({
            filename: filename,
            path: `/sprites/${filename}`,
            timestamp: new Date(),
            timeCode: timeCode
          });
        })
        .catch(err => reject(err));
    });
  }

  async tryGenerateSprite(streamUrl, outputPath) {
    return new Promise((resolve, reject) => {
      // Method 1: Direct screenshot
      ffmpeg(streamUrl)
        .inputOptions([
          '-t 3', // Only read 3 seconds
          '-reconnect 1',
          '-reconnect_streamed 1',
          '-reconnect_delay_max 2'
        ])
        .outputOptions([
          '-vframes 1', // Single frame
          '-vf scale=320:180', // Thumbnail size
          '-q:v 2' // Quality
        ])
        .output(outputPath)
        .on('end', () => {
          if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
            console.log(`✅ Sprite generated: ${path.basename(outputPath)}`);
            resolve();
          } else {
            reject(new Error('Sprite file empty or not created'));
          }
        })
        .on('error', (err) => {
          console.error(`❌ Sprite generation error: ${err.message}`);
          
          // Method 2: Try with seeking
          this.tryWithSeek(streamUrl, outputPath)
            .then(resolve)
            .catch(reject);
        })
        .run();
    });
  }

  async tryWithSeek(streamUrl, outputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg(streamUrl)
        .seekInput(2) // Seek 2 seconds in
        .inputOptions([
          '-t 1',
          '-reconnect 1',
          '-reconnect_streamed 1'
        ])
        .outputOptions([
          '-vframes 1',
          '-vf scale=320:180',
          '-q:v 2'
        ])
        .output(outputPath)
        .on('end', () => {
          if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
            console.log(`✅ Sprite generated with seek: ${path.basename(outputPath)}`);
            resolve();
          } else {
            reject(new Error('Sprite generation failed (seek method)'));
          }
        })
        .on('error', (err) => {
          console.error(`❌ Seek method failed: ${err.message}`);
          
          // Method 3: Create placeholder gray image
          this.createPlaceholder(outputPath)
            .then(resolve)
            .catch(reject);
        })
        .run();
    });
  }

  async createPlaceholder(outputPath) {
    return new Promise((resolve, reject) => {
      // Create a gray placeholder image using ffmpeg
      ffmpeg()
        .input('color=gray:s=320x180:d=0.1')
        .inputFormat('lavfi')
        .outputOptions(['-vframes 1'])
        .output(outputPath)
        .on('end', () => {
          console.log(`📦 Placeholder sprite created: ${path.basename(outputPath)}`);
          resolve();
        })
        .on('error', (err) => {
          reject(new Error(`Failed to create placeholder: ${err.message}`));
        })
        .run();
    });
  }

  async generateSpriteForStream(stream) {
    try {
      const sprite = await this.generateSprite(stream.url, stream._id);
      return sprite;
    } catch (error) {
      console.error(`Failed to generate sprite for ${stream.url}:`, error.message);
      
      // Return null so monitoring continues without sprite
      return null;
    }
  }

  cleanOldSprites(maxAge = 24 * 60 * 60 * 1000) {
    // Clean sprites older than maxAge (default 24 hours)
    try {
      const files = fs.readdirSync(this.spritesDir);
      const now = Date.now();

      files.forEach(file => {
        const filePath = path.join(this.spritesDir, file);
        const stats = fs.statSync(filePath);
        const age = now - stats.mtimeMs;

        if (age > maxAge) {
          fs.unlinkSync(filePath);
          console.log(`🗑️  Deleted old sprite: ${file}`);
        }
      });
    } catch (err) {
      console.error('Error cleaning old sprites:', err);
    }
  }
}

module.exports = SpriteGenerator;