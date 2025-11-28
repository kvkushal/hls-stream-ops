import { useState } from 'react'

function Sidebar({ streams, liveMetrics, selectedStream, onSelectStream, onAddStream, onRefresh }) {
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!url) return

    setLoading(true)
    try {
      await onAddStream(url, name || url)
      setUrl('')
      setName('')
    } catch (error) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  const getStreamStatus = (stream) => {
    const metrics = liveMetrics[stream._id]
    if (!metrics) return 'waiting'
    if (stream.status === 'error') return 'error'
    if (metrics.metrics?.status === 'warning') return 'warning'
    return 'healthy'
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1>HLS Monitoring Dashboard</h1>
      </div>

      <div className="add-source-section">
        <h3>HLS Source URL</h3>
        <form onSubmit={handleSubmit}>
          <input
            type="url"
            placeholder="https://.../playlist.m3u8"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
            required
          />
          <input
            type="text"
            placeholder="Stream name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
          />
          <button type="submit" disabled={loading} className="btn-add">
            {loading ? 'Adding...' : 'Add Source'}
          </button>
        </form>
        <p className="helper-text">
          The backend will probe the stream using hls-monitor and expose metrics/sprites.
        </p>
      </div>

      <div className="sources-section">
        <div className="sources-header">
          <h3>Sources</h3>
          <button onClick={onRefresh} className="btn-refresh">Refresh</button>
        </div>

        {streams.length === 0 ? (
          <div className="no-sources">No sources yet</div>
        ) : (
          <div className="sources-list">
            {streams.map(stream => {
              const status = getStreamStatus(stream)
              const isSelected = selectedStream?._id === stream._id
              
              return (
                <div 
                  key={stream._id}
                  className={`source-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => onSelectStream(stream)}
                >
                  <div className={`status-indicator status-${status}`} />
                  <div className="source-info">
                    <div className="source-name">{stream.name}</div>
                    <div className="source-url">{stream.url}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default Sidebar