function AlertPanel({ alerts, onClear }) {
  if (alerts.length === 0) return null

  const errorCount = alerts.filter(a => a.type === 'error').length
  const warningCount = alerts.filter(a => a.type === 'warning').length

  return (
    <div className="alert-panel">
      <div className="alert-header">
        <div>
          <h3>🚨 Alerts ({alerts.length})</h3>
          <span className="alert-summary">
            {errorCount} errors, {warningCount} warnings
          </span>
        </div>
        <button onClick={onClear} className="btn-clear">Clear All</button>
      </div>
      <div className="alert-list">
        {alerts.slice(0, 10).map((alert, i) => (
          <div key={i} className={`alert-item alert-${alert.type}`}>
            <span className="alert-message">{alert.message}</span>
            <span className="alert-time">{new Date(alert.timestamp).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default AlertPanel