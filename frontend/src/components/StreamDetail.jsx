import { useState, useEffect } from 'react'
import axios from 'axios'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

const API_URL = 'http://localhost:5000'

function StreamDetail({ stream, liveMetrics, onDelete }) {
  const [history, setHistory] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistory()
  }, [stream._id])

  const loadHistory = async () => {
    setLoading(true)
    try {
      const response = await axios.get(`${API_URL}/api/streams/${stream._id}/history`)
      setHistory(response.data)
    } catch (error) {
      console.error('Error loading history:', error)
    } finally {
      setLoading(false)
    }
  }

  const metrics = liveMetrics?.metrics || stream.currentMetrics
  const health = liveMetrics?.health || stream.health

  const formatBitrate = (bitrate) => {
    if (!bitrate) return 'N/A'
    return (bitrate / 1000000).toFixed(2) + ' Mbps'
  }

  const chartData = history?.metrics.map(m => ({
    time: new Date(m.timestamp).toLocaleTimeString(),
    latency: m.latency,
    timestamp: m.timestamp
  })) || []

  return (
    <div className="stream-detail">
      <div className="detail-header">
        <div>
          <h2>{stream.name}</h2>
          <p className="stream-url">{stream.url}</p>
        </div>
        <button onClick={() => onDelete(stream._id)} className="btn-delete">
          Delete Stream
        </button>
      </div>

      <div className="health-section">
        <div className="health-score">
          <div className="health-circle" style={{ 
            background: `conic-gradient(${health.score >= 70 ? '#00d4aa' : health.score >= 40 ? '#ffa500' : '#ff4757'} ${health.score * 3.6}deg, #2a2d3a ${health.score * 3.6}deg)` 
          }}>
            <div className="health-inner">
              <span className="health-value">{health.score}%</span>
              <span className="health-label">Health</span>
            </div>
          </div>
        </div>

        {health.issues && health.issues.length > 0 && (
          <div className="issues-list">
            <h4>Issues Detected:</h4>
            {health.issues.map((issue, i) => (
              <div key={i} className="issue-badge">⚠️ {issue}</div>
            ))}
          </div>
        )}
      </div>

      <div className="metrics-section">
        <h3>Current Metrics</h3>
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-icon">⚡</div>
            <div className="metric-content">
              <div className="metric-label">Latency</div>
              <div className="metric-value">{metrics.latency || 0}ms</div>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon">📊</div>
            <div className="metric-content">
              <div className="metric-label">Bitrate</div>
              <div className="metric-value">{formatBitrate(metrics.bitrate)}</div>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon">🎬</div>
            <div className="metric-content">
              <div className="metric-label">Variants</div>
              <div className="metric-value">{metrics.variantCount || 0}</div>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon">⏱️</div>
            <div className="metric-content">
              <div className="metric-label">Segment Duration</div>
              <div className="metric-value">{metrics.segmentDuration || 0}s</div>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon">
              {stream.status === 'error' ? '❌' : stream.status === 'active' ? '✅' : '⏸️'}
            </div>
            <div className="metric-content">
              <div className="metric-label">Status</div>
              <div className="metric-value">{stream.status.toUpperCase()}</div>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon">🕐</div>
            <div className="metric-content">
              <div className="metric-label">Last Updated</div>
              <div className="metric-value metric-value-small">
                {liveMetrics ? new Date(liveMetrics.timestamp).toLocaleTimeString() : 'Waiting...'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading timeline...</div>
      ) : (
        <>
          {chartData.length > 0 && (
            <div className="timeline-section">
              <h3>Latency Timeline</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
                  <XAxis dataKey="time" stroke="#8b8d98" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#8b8d98" label={{ value: 'Latency (ms)', angle: -90, position: 'insideLeft', fill: '#8b8d98' }} />
                  <Tooltip 
                    contentStyle={{ background: '#1e2029', border: '1px solid #2a2d3a', borderRadius: '4px' }}
                    labelStyle={{ color: '#8b8d98' }}
                  />
                  <ReferenceLine y={1000} stroke="#ffa500" strokeDasharray="3 3" label={{ value: 'Warning', fill: '#ffa500' }} />
                  <ReferenceLine y={3000} stroke="#ff4757" strokeDasharray="3 3" label={{ value: 'Critical', fill: '#ff4757' }} />
                  <Line type="monotone" dataKey="latency" stroke="#00d4aa" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {history?.sprites && history.sprites.length > 0 && (
            <div className="sprites-section">
              <h3>Stream Thumbnails</h3>
              <div className="sprites-grid">
                {history.sprites.map((sprite, i) => (
                  <div key={i} className="sprite-item">
                    <img src={`${API_URL}${sprite.path}`} alt={`Sprite ${i}`} />
                    <div className="sprite-time">
                      {new Date(sprite.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {history?.errors && history.errors.length > 0 && (
            <div className="errors-section">
              <h3>Error History</h3>
              <div className="errors-list">
                {history.errors.map((error, i) => (
                  <div key={i} className="error-item">
                    <div className={`error-severity error-severity-${error.severity}`}>
                      {error.severity.toUpperCase()}
                    </div>
                    <div className="error-content">
                      <div className="error-message">{error.message}</div>
                      <div className="error-meta">
                        <span className="error-type">{error.type}</span>
                        <span className="error-time">{new Date(error.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default StreamDetail