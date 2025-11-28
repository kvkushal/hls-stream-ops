function Dashboard({ streams, liveMetrics, alerts, onSelectStream }) {
  const healthyCount = streams.filter(s => s.status === 'active' && s.health.score >= 70).length
  const warningCount = streams.filter(s => s.health.score < 70 && s.health.score >= 40).length
  const errorCount = streams.filter(s => s.status === 'error' || s.health.score < 40).length

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>No Source Selected</h2>
        <p>Add a stream on the left or click an existing source.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card stat-healthy">
          <div className="stat-value">{healthyCount}</div>
          <div className="stat-label">Healthy Streams</div>
        </div>
        <div className="stat-card stat-warning">
          <div className="stat-value">{warningCount}</div>
          <div className="stat-label">Warnings</div>
        </div>
        <div className="stat-card stat-error">
          <div className="stat-value">{errorCount}</div>
          <div className="stat-label">Errors</div>
        </div>
        <div className="stat-card stat-total">
          <div className="stat-value">{streams.length}</div>
          <div className="stat-label">Total Streams</div>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="alerts-section">
          <h3>Recent Alerts</h3>
          <div className="alerts-list">
            {alerts.slice(0, 10).map((alert, i) => (
              <div key={i} className={`alert-item alert-${alert.type}`}>
                <span className="alert-icon">
                  {alert.type === 'error' ? '🔴' : '⚠️'}
                </span>
                <span className="alert-message">{alert.message}</span>
                <span className="alert-time">
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="streams-overview">
        <h3>All Streams</h3>
        <div className="streams-grid">
          {streams.map(stream => {
            const metrics = liveMetrics[stream._id]?.metrics || stream.currentMetrics
            const health = liveMetrics[stream._id]?.health || stream.health

            return (
              <div 
                key={stream._id} 
                className="stream-card"
                onClick={() => onSelectStream(stream)}
              >
                <div className="stream-card-header">
                  <h4>{stream.name}</h4>
                  <div className={`health-badge health-${health.score >= 70 ? 'good' : health.score >= 40 ? 'warning' : 'bad'}`}>
                    {health.score}%
                  </div>
                </div>
                <div className="stream-metrics-mini">
                  <div className="metric-mini">
                    <span className="metric-label">Latency</span>
                    <span className="metric-value">{metrics.latency || 0}ms</span>
                  </div>
                  <div className="metric-mini">
                    <span className="metric-label">Bitrate</span>
                    <span className="metric-value">
                      {metrics.bitrate ? (metrics.bitrate / 1000000).toFixed(1) + 'M' : 'N/A'}
                    </span>
                  </div>
                  <div className="metric-mini">
                    <span className="metric-label">Variants</span>
                    <span className="metric-value">{metrics.variantCount || 0}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default Dashboard