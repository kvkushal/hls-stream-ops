import StreamTile from './StreamTile'

function GridView({ streams, liveMetrics, onSelectStream, onRefresh }) {
  const healthyCount = streams.filter(s => s.health?.color === 'green').length
  const warningCount = streams.filter(s => s.health?.color === 'yellow').length
  const errorCount = streams.filter(s => s.health?.color === 'red').length

  return (
    <div className="grid-view">
      <div className="grid-header">
        <div className="stats-bar">
          <div className="stat-item stat-healthy">
            <span className="stat-dot"></span>
            <span className="stat-label">Healthy</span>
            <span className="stat-value">{healthyCount}</span>
          </div>
          <div className="stat-item stat-warning">
            <span className="stat-dot"></span>
            <span className="stat-label">Warning</span>
            <span className="stat-value">{warningCount}</span>
          </div>
          <div className="stat-item stat-error">
            <span className="stat-dot"></span>
            <span className="stat-label">Error</span>
            <span className="stat-value">{errorCount}</span>
          </div>
          <button onClick={onRefresh} className="btn-refresh">
            ↻ Refresh
          </button>
        </div>
      </div>

      {streams.length === 0 ? (
        <div className="empty-grid">
          <div className="empty-icon">📺</div>
          <h3>No streams being monitored</h3>
          <p>Add your first HLS stream using the button above</p>
        </div>
      ) : (
        <div className="grid-container">
          {streams.map(stream => (
            <StreamTile
              key={stream._id}
              stream={stream}
              liveMetrics={liveMetrics[stream._id]}
              onClick={() => onSelectStream(stream)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default GridView