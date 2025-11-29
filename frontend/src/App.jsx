import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import io from 'socket.io-client'
import GridView from './components/GridView'
import DetailView from './components/DetailView'
import Header from './components/Header'

const API_URL = 'http://localhost:5000'

function App() {
  const [streams, setStreams] = useState([])
  const [selectedStream, setSelectedStream] = useState(null)
  const [socket, setSocket] = useState(null)
  const [liveMetrics, setLiveMetrics] = useState({})
  const [soundEnabled, setSoundEnabled] = useState(true)
  const audioContextRef = useRef(null)

  // Initialize audio
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
    })

    newSocket.on('stream-error', (data) => {
      if (soundEnabled) {
        playAlertSound()
      }
      
      // Browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('🚨 HLS Stream Error', {
          body: `${data.error.message}`,
          icon: '/favicon.ico'
        })
      }
    })

    return () => newSocket.close()
  }, [soundEnabled])

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

  const playAlertSound = () => {
    try {
      initAudio()
      const audioContext = audioContextRef.current
      const now = audioContext.currentTime
      
      // Three beeps
      for (let i = 0; i < 3; i++) {
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()
        
        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)
        
        oscillator.frequency.value = 880
        oscillator.type = 'sine'
        
        const startTime = now + (i * 0.3)
        gainNode.gain.setValueAtTime(0.3, startTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2)
        
        oscillator.start(startTime)
        oscillator.stop(startTime + 0.2)
      }
    } catch (e) {
      console.log('Audio not supported')
    }
  }

  const handleAddStream = async (url, name) => {
    initAudio()
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
    initAudio()
    setSelectedStream(stream)
  }

  const handleBackToGrid = () => {
    setSelectedStream(null)
  }

  const toggleSound = () => {
    setSoundEnabled(!soundEnabled)
  }

  const testAlertSound = () => {
    initAudio()
    playAlertSound()
  }

  return (
    <div className="app" onClick={initAudio}>
      <Header 
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        onTestSound={testAlertSound}
        streamCount={streams.length}
        onAddStream={handleAddStream}
        onBackToGrid={selectedStream ? handleBackToGrid : null}
      />
      
      {selectedStream ? (
        <DetailView 
          stream={selectedStream}
          liveMetrics={liveMetrics[selectedStream._id]}
          onDelete={handleDeleteStream}
          onBack={handleBackToGrid}
        />
      ) : (
        <GridView 
          streams={streams}
          liveMetrics={liveMetrics}
          onSelectStream={handleSelectStream}
          onRefresh={fetchStreams}
        />
      )}
    </div>
  )
}

export default App