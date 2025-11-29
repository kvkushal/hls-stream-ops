const API_URL = 'http://localhost:5000'

function StreamTile({ stream, liveMetrics, onClick }) {
  const metrics = liveMetrics?.metrics || stream.currentMetrics
  const health = liveMetrics?.health || stream.health

  const getStatusClass = () => {
    if (stream.status === 'error') return 'tile-error'
    if (health?.color === 'red') return 'tile-error'
    if (health?.color === 'yellow') return 'tile-warning'
    return 'tile-healthy'
  }

  const hasSprite = stream.lastSpriteUrl && !stream.lastSpriteUrl.includes('placeholder')

  return (
    <div className={`stream-tile ${getStatusClass()}`} onClick={onClick}>
      <div className="tile-thumbnail">
        {hasSprite ? (
          <img 
            src={`${API_URL}${stream.lastSpriteUrl}`} 
            alt={stream.name}
            onError={(e) => {
              e.target.style.display = 'none'
              e.target.nextSibling.style.display = 'flex'
            }}
          />
        ) : null}
        <div 
          className="tile-placeholder" 
          style={{ display: hasSprite ? 'none' : 'flex' }}
        >
          {stream.status === 'error' ? (
            <>
              <span className="placeholder-icon">⚠️</span>
              <span className="placeholder-text">
                {stream.health?.issues?.[0] || 'Stream Error'}
              </span>
            </>
          ) : (
            <>
              <span className="placeholder-icon">📹</span>
              <span className="placeholder-text">Loading...</span>
            </>
          )}
        </div>
        
        <div className="tile-overlay">
          <div className={`status-badge status-${health?.color || 'gray'}`}>
            {health?.score || 0}%
          </div>
        </div>
      </div>

      <div className="tile-info">
        <div className="tile-name" title={stream.name}>
          {stream.name}
        </div>
        <div className="tile-metrics">
          <div className="tile-metric">
            <span className="metric-icon">⚡</span>
            <span>{metrics?.latency || 0}ms</span>
          </div>
          <div className="tile-metric">
            <span className="metric-icon">📊</span>
            <span>
              {metrics?.bitrate ? (metrics.bitrate / 1000000).toFixed(1) : '0'}M
            </span>
          </div>
          <div className="tile-metric">
            <span className="metric-icon">🎬</span>
            <span>{metrics?.variantCount || 0}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StreamTile