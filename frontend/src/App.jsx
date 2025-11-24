import { useState, useEffect } from 'react'
import axios from 'axios'

function App() {
  const [health, setHealth] = useState(null)

  useEffect(() => {
    axios.get('http://localhost:5000/health')
      .then(res => setHealth(res.data))
      .catch(err => console.error(err))
  }, [])

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>HLS Monitor Dashboard</h1>
      <p>Backend Status: {health ? health.message : 'Loading...'}</p>
    </div>
  )
}

export default App