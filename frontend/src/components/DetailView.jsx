import { useState, useEffect } from 'react'
import axios from 'axios'
import TimelineGraphs from './TimelineGraphs'
import SpriteTimeline from './SpriteTimeline'
import LogsPanel from './LogsPanel'
import VariantsPanel from './VariantsPanel'

const API_URL = 'http://localhost:5000'

function DetailView({ stream, liveMetrics, onDelete, onBack }) {
  const [history, setHistory] = useState(null)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedRange, setSelectedRange] = useState('30min')

  useEffect(() => {
    loadHistory(selectedRange)
    loadLogs()
  }, [stream._id, selectedRange])

  const loadHistory = async (range) => {
    setLoading(true)
    try {
      const response = await axios.get(`${API_URL}/api/streams/${stream._id}/history?range=${range}`)
      setHistory(response.data)
    } catch (error) {
      console.error('Error loading history:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadLogs = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/streams/${stream._id}/logs`)
      setLogs(response.data.logs)
    } catch (error) {
      console.error('Error loading logs:', error)
    }
  }

  const handleRangeChange = (range) => {
    setSelectedRange(range)
  }

  const handleDeleteStream = () => {
    if (window.confirm(`Delete "${stream.name}"?`)) {
      onDelete(stream._id)
    }
  }

  const metrics = liveMetrics?.metrics || stream.currentMetrics
  const health = liveMetrics?.health || stream.health

  const formatBitrate = (bitrate) => {
    if (!bitrate) return 'N/A'
    return (bitrate / 1000000).toFixed(2) + ' Mbps'
  }

  return (
    <div className="detail-view">
      {/* Stream Header */}
      <div className="detail-header">
        <div className="detail-title-section">
          <h2>{stream.name}</h2>
          <p className="stream-url">{stream.url}</p>
          <div className="stream-meta">
            <span>Added: {new Date(stream.createdAt).toLocaleString()}</span>
            <span>•</span>
            <span>Last Check: {new Date(stream.lastChecked).toLocaleTimeString()}</span>
          </div>
        </div>
        <div className="detail-actions">
          <button onClick={handleDeleteStream} className="btn-delete-detail">
            🗑️ Delete Stream
          </button>
        </div>
      </div>

      {/* Health Score Circle */}
      <div className="health-section">
        <div className="health-circle-container">
          <div 
            className="health-circle" 
            style={{ 
              background: `conic-gradient(${
                health.color === 'green' ? '#00d4aa' : 
                health.color === 'yellow' ? '#ffa500' : '#ff4757'
              } ${health.score * 3.6}deg, #2a3142 ${health.score * 3.6}deg)` 
            }}
          >
            <div className="health-inner">
              <span className="health-value">{health.score}%</span>
              <span className="health-label">Health</span>
            </div>
          </div>
        </div>

        {health.issues && health.issues.length > 0 && (
          <div className="issues-container">
            <h4>Issues Detected:</h4>
            {health.issues.map((issue, i) => (
              <div key={i} className={`issue-tag issue-${health.color}`}>
                ⚠️ {issue}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Current Metrics Cards */}
      <div className="metrics-cards">
        <div className="metric-card">
          <div className="metric-icon">⚡</div>
          <div className="metric-info">
            <div className="metric-label">Latency</div>
            <div className="metric-value">{metrics.latency || 0}ms</div>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon">📊</div>
          <div className="metric-info">
            <div className="metric-label">Bitrate</div>
            <div className="metric-value">{formatBitrate(metrics.bitrate)}</div>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon">⬇️</div>
          <div className="metric-info">
            <div className="metric-label">Download Speed</div>
            <div className="metric-value">
              {metrics.downloadSpeed ? metrics.downloadSpeed.toFixed(2) : '0'} MB/s
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon">🎬</div>
          <div className="metric-info">
            <div className="metric-label">Variants</div>
            <div className="metric-value">{metrics.variantCount || 0}</div>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon">⏱️</div>
          <div className="metric-info">
            <div className="metric-label">Segment Duration</div>
            <div className="metric-value">{metrics.segmentDuration || 0}s</div>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon">🕐</div>
          <div className="metric-info">
            <div className="metric-label">TTFB</div>
            <div className="metric-value">{metrics.ttfb || 0}ms</div>
          </div>
        </div>
      </div>

      {/* Range Selector */}
      <div className="range-selector">
        <span className="range-label">Time Range:</span>
        {['3min', '30min', '3h', '8h', '2d', '4d'].map(range => (
          <button
            key={range}
            className={`range-btn ${selectedRange === range ? 'active' : ''}`}
            onClick={() => handleRangeChange(range)}
          >
            {range}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading timeline data...</p>
        </div>
      ) : (
        <>
          {/* Timeline Graphs */}
          <TimelineGraphs data={history} />

          {/* Sprite Timeline */}
          {history?.sprites && history.sprites.length > 0 && (
            <SpriteTimeline sprites={history.sprites} />
          )}

          {/* Variants Panel */}
          {history?.variants && history.variants.length > 0 && (
            <VariantsPanel variants={history.variants} />
          )}

          {/* Logs Panel */}
          <LogsPanel logs={logs} streamName={stream.name} onRefresh={loadLogs} />
        </>
      )}
    </div>
  )
}

export default DetailView