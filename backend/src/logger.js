const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logsDir = path.join(__dirname, '../logs');
    this.ensureLogsDir();
    this.currentDate = this.getDate();
    this.currentLogFile = this.getLogFilePath();
    this.startMidnightRotation();
  }

  ensureLogsDir() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  getDate() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  getLogFilePath() {
    return path.join(this.logsDir, `${this.currentDate}.txt`);
  }

  startMidnightRotation() {
    // Check every minute if we've crossed midnight
    setInterval(() => {
      const newDate = this.getDate();
      if (newDate !== this.currentDate) {
        this.currentDate = newDate;
        this.currentLogFile = this.getLogFilePath();
        this.log('SYSTEM', 'Log file rotated to new day', 'info');
      }
    }, 60000); // Check every minute
  }

  formatTimestamp() {
    const now = new Date();
    return now.toISOString().replace('T', ' ').substring(0, 19);
  }

  log(type, message, severity = 'info', metadata = {}) {
    const timestamp = this.formatTimestamp();
    const metaStr = Object.keys(metadata).length > 0 ? ` | ${JSON.stringify(metadata)}` : '';
    const logEntry = `${timestamp} | ${severity.toUpperCase().padEnd(8)} | ${type.padEnd(25)} | ${message}${metaStr}\n`;

    // Append to file
    fs.appendFileSync(this.currentLogFile, logEntry, 'utf8');
    
    // Also console log
    console.log(logEntry.trim());

    return {
      timestamp: new Date(),
      type,
      message,
      severity,
      metadata
    };
  }

  streamLog(streamUrl, streamName, event, severity, details = {}) {
    return this.log(
      `STREAM: ${streamName}`,
      event,
      severity,
      { url: streamUrl, ...details }
    );
  }

  getLogFile(date) {
    const filePath = path.join(this.logsDir, `${date}.txt`);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
    return null;
  }

  getRecentLogs(lines = 100) {
    if (!fs.existsSync(this.currentLogFile)) {
      return [];
    }
    
    const content = fs.readFileSync(this.currentLogFile, 'utf8');
    const allLines = content.split('\n').filter(line => line.trim());
    return allLines.slice(-lines);
  }
}

module.exports = new Logger();