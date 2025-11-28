import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import io from 'socket.io-client'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import StreamDetail from './components/StreamDetail'

const API_URL = 'http://localhost:5000'

function App() {
  const [streams, setStreams] = useState([])
  const [selectedStream, setSelectedStream] = useState(null)
  const [socket, setSocket] = useState(null)
  const [liveMetrics, setLiveMetrics] = useState({})
  const [alerts, setAlerts] = useState([])
  const [soundEnabled, setSoundEnabled] = useState(true)
  const audioContextRef = useRef(null)

  // Initialize audio context on user interaction
  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
  }

  // WebSocket connection
  useEffect(() => {
    const newSocket = io(API_URL)
    setSocket(newSocket)

    newSocket.on('metrics', (data) => {
      setLiveMetrics(prev => ({
        ...prev,
        [data.streamId]: data
      }))

      // Add alert for warnings/errors
      if (data.metrics.status !== 'ok') {
        const alertMsg = {
          streamId: data.streamId,
          type: data.metrics.status,
          message: `${data.url}: ${data.metrics.status === 'error' ? 'Error' : 'Warning'} - Latency ${data.metrics.latency}ms`,
          timestamp: new Date()
        }
        addAlert(alertMsg)
        
        if (data.metrics.status === 'error') {
          playAlertSound()
        }
      }
    })

    newSocket.on('stream-error', (data) => {
      const alertMsg = {
        streamId: data.streamId,
        type: 'error',
        message: `${data.url}: ${data.error.message}`,
        timestamp: new Date()
      }
      addAlert(alertMsg)
      playAlertSound()
    })

    return () => newSocket.close()
  }, [])

  useEffect(() => {
    fetchStreams()
    const interval = setInterval(fetchStreams, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchStreams = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/streams`)
      setStreams(response.data.streams)
    } catch (error) {
      console.error('Error fetching streams:', error)
    }
  }

  const addAlert = (alert) => {
    setAlerts(prev => {
      const newAlerts = [alert, ...prev].slice(0, 100)
      // Show browser notification for errors
      if (alert.type === 'error' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('🚨 HLS Stream Error', {
          body: alert.message,
          icon: '/favicon.ico'
        })
      }
      return newAlerts
    })
  }

  const playAlertSound = () => {
    if (!soundEnabled) return
    
    try {
      initAudio()
      const audioContext = audioContextRef.current
      
      // Create a more noticeable alert sound (three beeps)
      const now = audioContext.currentTime
      
      for (let i = 0; i < 3; i++) {
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()
        
        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)
        
        oscillator.frequency.value = 880 // A5 note
        oscillator.type = 'sine'
        
        const startTime = now + (i * 0.3)
        gainNode.gain.setValueAtTime(0.3, startTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2)
        
        oscillator.start(startTime)
        oscillator.stop(startTime + 0.2)
      }
    } catch (e) {
      console.log('Audio not supported:', e)
    }
  }

  const handleAddStream = async (url, name) => {
    initAudio() // Initialize audio on user interaction
    try {
      await axios.post(`${API_URL}/api/streams`, { url, name })
      fetchStreams()
      return true
    } catch (error) {
      throw new Error(error.response?.data?.error || error.message)
    }
  }

  const handleDeleteStream = async (id) => {
    try {
      await axios.delete(`${API_URL}/api/streams/${id}`)
      if (selectedStream?._id === id) {
        setSelectedStream(null)
      }
      fetchStreams()
    } catch (error) {
      alert('Error deleting stream')
    }
  }

  const handleSelectStream = (stream) => {
    initAudio() // Initialize audio on user interaction
    setSelectedStream(stream)
  }

  const toggleSound = () => {
    setSoundEnabled(!soundEnabled)
  }

  const testAlertSound = () => {
    initAudio()
    playAlertSound()
  }

  const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }

  return (
    <div className="app" onClick={initAudio}>
      <Sidebar 
        streams={streams}
        liveMetrics={liveMetrics}
        selectedStream={selectedStream}
        onSelectStream={handleSelectStream}
        onAddStream={handleAddStream}
        onRefresh={fetchStreams}
      />
      
      <div className="main-content">
        {/* Alert Controls */}
        <div className="alert-controls">
          <button 
            onClick={toggleSound} 
            className={`btn-toggle-sound ${soundEnabled ? 'enabled' : 'disabled'}`}
            title={soundEnabled ? 'Sound Enabled' : 'Sound Disabled'}
          >
            {soundEnabled ? '🔔 Sound ON' : '🔕 Sound OFF'}
          </button>
          <button onClick={testAlertSound} className="btn-test-sound">
            🎵 Test Alert
          </button>
          {('Notification' in window && Notification.permission === 'default') && (
            <button onClick={requestNotificationPermission} className="btn-enable-notifications">
              🔔 Enable Notifications
            </button>
          )}
        </div>

        {selectedStream ? (
          <StreamDetail 
            stream={selectedStream}
            liveMetrics={liveMetrics[selectedStream._id]}
            onDelete={handleDeleteStream}
          />
        ) : (
          <Dashboard 
            streams={streams}
            liveMetrics={liveMetrics}
            alerts={alerts}
            onSelectStream={handleSelectStream}
          />
        )}
      </div>
    </div>
  )
}

export default App