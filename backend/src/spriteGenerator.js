const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

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

      ffmpeg(streamUrl)
        .screenshots({
          count: 1,
          folder: this.spritesDir,
          filename: filename,
          size: '320x180'
        })
        .on('end', () => {
          console.log(`✅ Sprite generated: ${filename}`);
          resolve({
            filename: filename,
            path: `/sprites/${filename}`,
            timestamp: new Date()
          });
        })
        .on('error', (err) => {
          console.error('❌ Sprite generation error:', err.message);
          reject(err);
        });
    });
  }

  async generateSpriteForStream(stream) {
    try {
      const sprite = await this.generateSprite(stream.url, stream._id);
      return sprite;
    } catch (error) {
      console.error(`Failed to generate sprite for ${stream.url}:`, error.message);
      return null;
    }
  }
}

module.exports = SpriteGenerator;