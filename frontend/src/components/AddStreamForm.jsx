import { useState } from 'react'
import axios from 'axios'

const API_URL = 'http://localhost:5000'

function AddStreamForm({ onStreamAdded }) {
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!url) return

    setLoading(true)
    try {
      await axios.post(`${API_URL}/api/streams`, {
        url,
        name: name || url
      })
      setUrl('')
      setName('')
      onStreamAdded()
    } catch (error) {
      alert('Error: ' + (error.response?.data?.error || error.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="add-stream-form">
      <h2>Add New Stream</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <input
            type="url"
            placeholder="HLS Stream URL (e.g., https://...m3u8)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            disabled={loading}
          />
          <input
            type="text"
            placeholder="Stream Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Adding...' : '+ Add Stream'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default AddStreamForm