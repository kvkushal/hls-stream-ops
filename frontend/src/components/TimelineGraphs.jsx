import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

function TimelineGraphs({ data }) {
  if (!data || !data.metrics || data.metrics.length === 0) {
    return (
      <div className="timeline-section">
        <div className="no-data">
          <p>No timeline data available yet. Metrics will appear after monitoring starts.</p>
        </div>
      </div>
    )
  }

  // Format data for charts
  const chartData = data.metrics.map(m => ({
    time: new Date(m.timestamp).toLocaleTimeString(),
    latency: m.latency,
    downloadSpeed: m.downloadSpeed ? (m.downloadSpeed * 8).toFixed(2) : 0, // Convert to Mbps
    bitrate: m.bitrate ? (m.bitrate / 1000000).toFixed(2) : 0, // Convert to Mbps
    ttfb: m.ttfb || 0,
    timestamp: m.timestamp
  }))

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.value}{entry.unit || ''}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="timeline-section">
      <h3>Timeline Graphs</h3>

      {/* Latency Graph */}
      <div className="graph-container">
        <h4>Latency (ms)</h4>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3142" />
            <XAxis 
              dataKey="time" 
              stroke="#8b8d98" 
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis 
              stroke="#8b8d98" 
              tick={{ fontSize: 11 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={1000} stroke="#ffa500" strokeDasharray="3 3" label={{ value: 'Warning (1s)', fill: '#ffa500', fontSize: 11 }} />
            <ReferenceLine y={3000} stroke="#ff4757" strokeDasharray="3 3" label={{ value: 'Critical (3s)', fill: '#ff4757', fontSize: 11 }} />
            <Line 
              type="monotone" 
              dataKey="latency" 
              stroke="#00d4aa" 
              strokeWidth={2} 
              dot={{ r: 2 }}
              name="Latency"
              unit="ms"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Download Speed Graph */}
      <div className="graph-container">
        <h4>Download Speed (Mbps)</h4>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3142" />
            <XAxis 
              dataKey="time" 
              stroke="#8b8d98" 
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis 
              stroke="#8b8d98" 
              tick={{ fontSize: 11 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey="downloadSpeed" 
              stroke="#5b9cff" 
              strokeWidth={2} 
              dot={{ r: 2 }}
              name="Speed"
              unit=" Mbps"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Bitrate Graph */}
      <div className="graph-container">
        <h4>Bitrate (Mbps)</h4>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3142" />
            <XAxis 
              dataKey="time" 
              stroke="#8b8d98" 
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis 
              stroke="#8b8d98" 
              tick={{ fontSize: 11 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey="bitrate" 
              stroke="#ff6b9d" 
              strokeWidth={2} 
              dot={{ r: 2 }}
              name="Bitrate"
              unit=" Mbps"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* TTFB Graph */}
      <div className="graph-container">
        <h4>Time to First Byte (ms)</h4>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3142" />
            <XAxis 
              dataKey="time" 
              stroke="#8b8d98" 
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis 
              stroke="#8b8d98" 
              tick={{ fontSize: 11 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey="ttfb" 
              stroke="#ffa500" 
              strokeWidth={2} 
              dot={{ r: 2 }}
              name="TTFB"
              unit="ms"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default TimelineGraphs