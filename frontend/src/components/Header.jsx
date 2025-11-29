import { useState } from 'react'

function Header({ soundEnabled, onToggleSound, onTestSound, streamCount, onAddStream, onBackToGrid }) {
  const [showAddForm, setShowAddForm] = useState(false)
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
      setShowAddForm(false)
    } catch (error) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <header className="header">
      <div className="header-left">
        {onBackToGrid && (
          <button onClick={onBackToGrid} className="btn-back">
            ← Back to Grid
          </button>
        )}
        <h1>HLS Stream Monitor</h1>
        <span className="stream-count">{streamCount} streams</span>
      </div>

      <div className="header-center">
        {!showAddForm ? (
          <button onClick={() => setShowAddForm(true)} className="btn-add-stream">
            + Add Stream
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="inline-add-form">
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
              placeholder="Stream name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
            <button type="submit" disabled={loading}>Add</button>
            <button type="button" onClick={() => setShowAddForm(false)} className="btn-cancel">
              Cancel
            </button>
          </form>
        )}
      </div>

      <div className="header-right">
        <button 
          onClick={onToggleSound} 
          className={`btn-icon ${soundEnabled ? 'active' : ''}`}
          title={soundEnabled ? 'Sound ON' : 'Sound OFF'}
        >
          {soundEnabled ? '🔔' : '🔕'}
        </button>
        <button onClick={onTestSound} className="btn-icon" title="Test Alert">
          🎵
        </button>
      </div>
    </header>
  )
}

export default Header