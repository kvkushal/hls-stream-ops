function LogsPanel({ logs, streamName, onRefresh }) {
  const parseLogs = (logLines) => {
    return logLines.map((line, index) => {
      const parts = line.split('|').map(p => p.trim())
      if (parts.length >= 3) {
        return {
          timestamp: parts[0],
          severity: parts[1],
          type: parts[2],
          message: parts[3] || '',
          key: index
        }
      }
      return {
        timestamp: '',
        severity: 'INFO',
        type: '',
        message: line,
        key: index
      }
    })
  }

  const parsedLogs = parseLogs(logs)

  const getSeverityClass = (severity) => {
    if (severity.includes('HIGH')) return 'log-high'
    if (severity.includes('MEDIUM')) return 'log-medium'
    return 'log-info'
  }

  return (
    <div className="logs-section">
      <div className="logs-header">
        <h3>Event Logs</h3>
        <button onClick={onRefresh} className="btn-refresh-logs">
          ↻ Refresh
        </button>
      </div>

      {parsedLogs.length === 0 ? (
        <div className="no-logs">No logs available yet</div>
      ) : (
        <div className="logs-container">
          <div className="logs-table-header">
            <span className="log-col-time">Timestamp</span>
            <span className="log-col-severity">Severity</span>
            <span className="log-col-type">Event Type</span>
            <span className="log-col-message">Message</span>
          </div>
          <div className="logs-table-body">
            {parsedLogs.map(log => (
              <div key={log.key} className={`log-row ${getSeverityClass(log.severity)}`}>
                <span className="log-col-time">{log.timestamp}</span>
                <span className="log-col-severity">
                  <span className="severity-badge">{log.severity}</span>
                </span>
                <span className="log-col-type">{log.type}</span>
                <span className="log-col-message">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default LogsPanel