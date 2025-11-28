import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

function MetricsChart({ data, errors }) {
  if (!data || data.length === 0) {
    return <div className="no-data">No historical data yet. Wait for metrics to accumulate.</div>
  }

  // Format data for chart
  const chartData = data.map(m => ({
    time: new Date(m.timestamp).toLocaleTimeString(),
    latency: m.latency,
    timestamp: m.timestamp
  }))

  return (
    <div className="metrics-chart">
      <h4>Latency Timeline (Last {data.length} checks)</h4>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" tick={{ fontSize: 12 }} />
          <YAxis label={{ value: 'Latency (ms)', angle: -90, position: 'insideLeft' }} />
          <Tooltip />
          <ReferenceLine y={1000} stroke="orange" strokeDasharray="3 3" label="Warning (1s)" />
          <ReferenceLine y={3000} stroke="red" strokeDasharray="3 3" label="Critical (3s)" />
          <Line type="monotone" dataKey="latency" stroke="#007bff" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>

      {errors && errors.length > 0 && (
        <div className="error-timeline">
          <h4>Recent Errors</h4>
          {errors.slice(0, 5).map((err, i) => (
            <div key={i} className="error-item">
              <span className="error-badge">{err.severity}</span>
              <span>{err.message}</span>
              <span className="error-time">{new Date(err.timestamp).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default MetricsChart