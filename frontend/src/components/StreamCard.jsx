import { useState } from 'react'
import axios from 'axios'
import MetricsChart from './MetricsChart'

const API_URL = 'http://localhost:5000'

function StreamCard({ stream, liveMetrics, onDelete }) {
  const [showDetails, setShowDetails] = useState(false)
  const [history, setHistory] = useState(null)

  const metrics = liveMetrics?.metrics || stream.currentMetrics
  const health = liveMetrics?.health || stream.health

  const getStatusColor = () => {
    if (stream.status === 'error') return '#dc3545'
    if (health.score < 70) return '#ffc107'
    return '#28a745'
  }

  const formatBitrate = (bitrate) => {
    if (!bitrate) return 'N/A'
    return (bitrate / 1000000).toFixed(2) + ' Mbps'
  }

  const loadHistory = async () => {
    if (showDetails && !history) {
      try {
        const response = await axios.get(`${API_URL}/api/streams/${stream._id}/history`)
        setHistory(response.data)
      } catch (error) {
        console.error('Error loading history:', error)
      }
    }
  }

  const toggleDetails = () => {
    setShowDetails(!showDetails)
    if (!showDetails) loadHistory()
  }

  return (
    <div className="stream-card" style={{ borderColor: getStatusColor() }}>
      <div className="stream-header">
        <div className="stream-info">
          <h3>{stream.name}</h3>
          <p className="stream-url">{stream.url}</p>
          <div className="stream-meta">
            <span>Added: {new Date(stream.createdAt).toLocaleDateString()}</span>
            <span>Last Check: {new Date(stream.lastChecked).toLocaleTimeString()}</span>
          </div>
        </div>
        <button className="btn-delete" onClick={onDelete}>
          Delete
        </button>
      </div>

      <div className="health-bar">
        <div 
          className="health-fill" 
          style={{ 
            width: `${health.score}%`,
            backgroundColor: getStatusColor()
          }}
        />
        <span className="health-text">Health: {health.score}%</span>
      </div>

      {health.issues && health.issues.length > 0 && (
        <div className="issues-list">
          {health.issues.map((issue, i) => (
            <div key={i} className="issue-badge">⚠️ {issue}</div>
          ))}
        </div>
      )}

      <div className="metrics-grid">
        <div className="metric">
          <span className="metric-label">Status</span>
          <span className="metric-value" style={{ color: getStatusColor() }}>
            {stream.status === 'error' ? '✗' : '✓'} {stream.status.toUpperCase()}
          </span>
        </div>
        <div className="metric">
          <span className="metric-label">Latency</span>
          <span className="metric-value">{metrics.latency || 0}ms</span>
        </div>
        <div className="metric">
          <span className="metric-label">Bitrate</span>
          <span className="metric-value">{formatBitrate(metrics.bitrate)}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Variants</span>
          <span className="metric-value">{metrics.variantCount || 0}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Segment Duration</span>
          <span className="metric-value">{metrics.segmentDuration || 0}s</span>
        </div>
        <div className="metric">
          <span className="metric-label">Last Updated</span>
          <span className="metric-value">
            {liveMetrics ? new Date(liveMetrics.timestamp).toLocaleTimeString() : 'Waiting...'}
          </span>
        </div>
      </div>

      <button className="btn-details" onClick={toggleDetails}>
        {showDetails ? '▲ Hide Timeline' : '▼ Show Timeline'}
      </button>

      {showDetails && history && (
        <div className="stream-details">
          <MetricsChart data={history.metrics} errors={history.errors} />
        </div>
      )}
    </div>
  )
}

export default StreamCard