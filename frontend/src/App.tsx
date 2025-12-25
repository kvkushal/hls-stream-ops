/**
 * HLS Stream Operations Platform - Main Application
 * 
 * Three-layer architecture:
 * 1. Monitoring Mode - Stream list with health badges (no charts)
 * 2. Investigation Mode - Incident timeline + root cause
 * 3. Analysis Mode - Charts for deeper investigation
 */

import React, { useEffect, useState } from 'react'
import './index.css'
import {
    streamApi, incidentApi,
    StreamSummary, StreamDetails, Incident, RootCause,
    MetricsHistory
} from './services/api'

// =============================================================================
// UTILITY COMPONENTS
// =============================================================================

const HealthBadge: React.FC<{ state: string }> = ({ state }) => {
    const colors = {
        green: 'bg-green-500',
        yellow: 'bg-yellow-500',
        red: 'bg-red-500'
    }
    // User-facing labels: HEALTHY, DEGRADED, UNHEALTHY
    const labels = {
        green: 'HEALTHY',
        yellow: 'DEGRADED',
        red: 'UNHEALTHY'
    }
    return (
        <span className={`${colors[state as keyof typeof colors] || 'bg-gray-500'} text-white text-xs font-bold px-2 py-1 rounded`}>
            {labels[state as keyof typeof labels] || 'UNKNOWN'}
        </span>
    )
}

const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
}

// =============================================================================
// MONITORING MODE - Stream Card
// =============================================================================

const StreamCard: React.FC<{
    stream: StreamSummary
    onClick: () => void
    onDelete: (id: string) => void
}> = ({ stream, onClick, onDelete }) => {
    // Extract hostname from manifest URL for display
    const getHostname = (url: string) => {
        try {
            return new URL(url).hostname
        } catch {
            return ''
        }
    }

    return (
        <div
            className="bg-gray-900 border border-gray-700 rounded-lg p-4 cursor-pointer hover:border-blue-500 transition-colors"
            onClick={onClick}
        >
            <div className="flex justify-between items-start mb-2">
                <div className="flex-1 min-w-0">
                    <h3 className="text-white font-semibold text-lg truncate">
                        {stream.name}
                    </h3>
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(stream.id); }}
                    className="text-gray-500 hover:text-red-400 ml-2"
                    title="Delete stream"
                >
                    ×
                </button>
            </div>

            <div className="flex items-center gap-2 mb-3">
                <HealthBadge state={stream.health?.state || 'unknown'} />
                {stream.has_active_incident && (
                    <span className="bg-red-800 text-red-200 text-xs px-2 py-1 rounded">
                        INCIDENT
                    </span>
                )}
            </div>

            {/* Limit to 2 reasons for scannability */}
            <p className="text-gray-400 text-sm">
                {(() => {
                    const reason = stream.health?.reason || 'Waiting for data...'
                    const parts = reason.split('; ')
                    if (parts.length <= 2) return reason
                    return parts.slice(0, 2).join('; ')
                })()}
            </p>

            {stream.thumbnail_url && (
                <div className="mt-3 aspect-video bg-gray-800 rounded overflow-hidden">
                    <img
                        src={stream.thumbnail_url}
                        alt="Stream thumbnail"
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                </div>
            )}
        </div>
    )
}

// =============================================================================
// ROOT CAUSE PANEL
// =============================================================================

const RootCausePanel: React.FC<{ rootCause: RootCause | null }> = ({ rootCause }) => {
    if (!rootCause) {
        return (
            <div className="bg-gray-900 border border-green-900 rounded-lg p-4 text-center">
                <span className="text-green-400 text-lg font-medium">No Issues Detected</span>
                <p className="text-gray-500 text-sm mt-2">Stream is operating normally</p>
            </div>
        )
    }

    // Format confidence as part of the statement
    const confidenceLabel = {
        high: 'High confidence',
        medium: 'Medium confidence',
        low: 'Low confidence'
    }

    return (
        <div className="bg-gray-900 border border-orange-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Root Cause Analysis</h3>

            {/* Root cause with inline confidence */}
            <div className="text-lg font-bold text-white mb-1">
                {rootCause.label}
            </div>
            <div className="text-sm text-orange-400 mb-3">
                {confidenceLabel[rootCause.confidence as keyof typeof confidenceLabel] || 'Unknown confidence'}
            </div>

            <div className="space-y-1">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Evidence</div>
                {rootCause.evidence.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                        <span className="text-orange-400 mt-0.5">•</span>
                        <span className="text-gray-300">{item}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

// =============================================================================
// SIMPLE CHART COMPONENT (No external dependency)
// =============================================================================

const SimpleChart: React.FC<{
    title: string
    data: { x: number; y: number }[]
    yLabel: string
    color: string
    threshold?: number
}> = ({ title, data, yLabel, color, threshold }) => {
    if (data.length === 0) {
        return (
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                <h4 className="text-gray-400 text-sm mb-2">{title}</h4>
                <div className="h-32 flex items-center justify-center text-gray-600 text-sm">
                    No data observed in this time window
                </div>
            </div>
        )
    }

    const maxY = Math.max(...data.map(d => d.y), threshold || 1, 1)
    const minY = Math.min(...data.map(d => d.y), 0)
    const range = maxY - minY || 1
    const thresholdPercent = threshold ? ((threshold - minY) / range) * 100 : null

    return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
                <h4 className="text-gray-400 text-sm">{title}</h4>
                <span className="text-xs text-gray-500">{yLabel}</span>
            </div>
            <div className="h-32 flex items-end gap-0.5 relative">
                {/* Threshold line */}
                {thresholdPercent !== null && (
                    <div
                        className="absolute w-full border-t border-dashed border-yellow-600 opacity-50"
                        style={{ bottom: `${thresholdPercent}%` }}
                    />
                )}
                {data.slice(-60).map((point, idx) => {
                    const height = ((point.y - minY) / range) * 100
                    return (
                        <div
                            key={idx}
                            className={`flex-1 rounded-t-sm ${color}`}
                            style={{ height: `${Math.max(height, 2)}%` }}
                            title={`${point.y.toFixed(1)}${yLabel}`}
                        />
                    )
                })}
            </div>
            <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>{minY.toFixed(0)}</span>
                <span>{maxY.toFixed(0)}</span>
            </div>
        </div>
    )
}

// =============================================================================
// ANALYSIS MODE - Charts Panel
// =============================================================================

const AnalysisPanel: React.FC<{ streamId: string }> = ({ streamId }) => {
    const [history, setHistory] = useState<MetricsHistory | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const response = await streamApi.getMetricsHistory(streamId, 30)
                setHistory(response.data)
            } catch (error) {
                console.error('Error fetching metrics history:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchHistory()
        const interval = setInterval(fetchHistory, 10000)
        return () => clearInterval(interval)
    }, [streamId])

    if (loading) {
        return <div className="text-gray-500 text-center py-8">Loading charts...</div>
    }

    if (!history) {
        return <div className="text-gray-500 text-center py-8">Unable to load metrics data</div>
    }

    // Transform data for charts
    const ttfbData = history.data_points
        .filter(d => !d.is_error)
        .map((d, idx) => ({ x: idx, y: d.ttfb_ms }))

    const ratioData = history.data_points
        .filter(d => !d.is_error)
        .map((d, idx) => ({ x: idx, y: d.download_ratio }))

    const errorData = history.error_rate_series
        .map((d, idx) => ({ x: idx, y: d.error_count }))

    return (
        <div className="space-y-4">
            <div className="bg-gray-800 p-3 rounded-lg text-center">
                <div className="text-sm text-gray-400">Analysis Mode — Metrics from the last 30 minutes</div>
                <div className="text-xs text-gray-500 mt-1">Charts support diagnosis, they do not define health.</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SimpleChart
                    title="TTFB Over Time"
                    data={ttfbData}
                    yLabel="ms"
                    color="bg-blue-500"
                    threshold={500}  // Yellow threshold
                />
                <SimpleChart
                    title="Download Ratio"
                    data={ratioData}
                    yLabel="x"
                    color="bg-green-500"
                    threshold={1.0}  // Baseline
                />
                <SimpleChart
                    title="Errors Per Minute"
                    data={errorData}
                    yLabel=""
                    color="bg-red-500"
                />
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                    <h4 className="text-gray-400 text-sm mb-2">Health State Timeline</h4>
                    <div className="h-32 flex items-center gap-0.5">
                        {history.health_timeline.length === 0 ? (
                            <div className="text-gray-600 text-center w-full text-sm">
                                No health state transitions in this window
                            </div>
                        ) : (
                            history.health_timeline.map((entry, idx) => (
                                <div
                                    key={idx}
                                    className={`flex-1 h-full rounded ${entry.state === 'red' ? 'bg-red-500' :
                                        entry.state === 'yellow' ? 'bg-yellow-500' :
                                            'bg-green-500'
                                        }`}
                                    title={`${entry.state.toUpperCase()} at ${formatTime(entry.timestamp)}`}
                                />
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// =============================================================================
// INVESTIGATION/ANALYSIS VIEW
// =============================================================================

const InvestigationView: React.FC<{
    streamId: string
    onBack: () => void
}> = ({ streamId, onBack }) => {
    const [details, setDetails] = useState<StreamDetails | null>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'investigate' | 'analyze'>('investigate')

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const response = await streamApi.getStream(streamId)
                setDetails(response.data)
            } catch (error) {
                console.error('Error fetching stream details:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchDetails()
        const interval = setInterval(fetchDetails, 2000)
        return () => clearInterval(interval)
    }, [streamId])

    const handleAcknowledge = async () => {
        if (details?.active_incident) {
            try {
                await incidentApi.acknowledgeIncident(details.active_incident.incident_id)
                const response = await streamApi.getStream(streamId)
                setDetails(response.data)
            } catch (error) {
                console.error('Error acknowledging incident:', error)
            }
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
                <div className="text-xl">Loading...</div>
            </div>
        )
    }

    if (!details) {
        return (
            <div className="min-h-screen bg-gray-950 text-white p-6">
                <button onClick={onBack} className="text-blue-400 hover:text-blue-300 mb-4">
                    ← Back to Streams
                </button>
                <div className="text-xl text-red-400">Stream not found</div>
            </div>
        )
    }

    const incident = details.active_incident

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            {/* Header */}
            <header className="bg-gray-900 border-b border-gray-700 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="text-gray-400 hover:text-white">
                            ← Back
                        </button>
                        <h1 className="text-xl font-bold">{details.name}</h1>
                        <HealthBadge state={details.health?.state || 'unknown'} />
                    </div>
                    <div className="flex items-center gap-4">
                        {incident && incident.status === 'open' && (
                            <button
                                onClick={handleAcknowledge}
                                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded font-medium"
                            >
                                Acknowledge Incident
                            </button>
                        )}
                    </div>
                </div>

                {/* Mode Tabs - No emojis */}
                <div className="flex gap-1 mt-4">
                    <button
                        onClick={() => setActiveTab('investigate')}
                        className={`px-4 py-2 rounded-t font-medium ${activeTab === 'investigate'
                            ? 'bg-gray-800 text-white'
                            : 'bg-gray-900 text-gray-500 hover:text-gray-300'
                            }`}
                    >
                        Investigate
                    </button>
                    <button
                        onClick={() => setActiveTab('analyze')}
                        className={`px-4 py-2 rounded-t font-medium ${activeTab === 'analyze'
                            ? 'bg-gray-800 text-white'
                            : 'bg-gray-900 text-gray-500 hover:text-gray-300'
                            }`}
                    >
                        Analyze
                    </button>
                </div>
            </header>

            <div className="p-6">
                {activeTab === 'investigate' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left: Health + Root Cause */}
                        <div className="lg:col-span-1 space-y-4">
                            {/* Health Panel */}
                            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                                <h2 className="text-sm font-medium text-gray-400 mb-3">Current Health</h2>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">State</span>
                                        <HealthBadge state={details.health?.state || 'unknown'} />
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Errors (last 2 min)</span>
                                        <span className="text-white">{details.health?.error_count_2min || 0}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Avg TTFB</span>
                                        <span className="text-white">{(details.health?.avg_ttfb_ms || 0).toFixed(0)} ms</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Download Ratio</span>
                                        <span className="text-white">{(details.health?.avg_download_ratio || 1).toFixed(2)}x</span>
                                    </div>
                                </div>
                                <p className="mt-3 text-sm text-gray-400 italic border-t border-gray-800 pt-3">
                                    {details.health?.reason || 'No health data yet'}
                                </p>
                            </div>

                            {/* Root Cause Panel */}
                            <RootCausePanel rootCause={details.root_cause} />

                            {/* Incident Panel */}
                            {incident && (
                                <div className="bg-gray-900 border border-red-900 rounded-lg p-4">
                                    <h2 className="text-sm font-medium text-red-400 mb-3">
                                        Active Incident
                                    </h2>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">ID</span>
                                            <span className="text-white font-mono text-xs">{incident.incident_id}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Status</span>
                                            <span className={`font-medium ${incident.status === 'acknowledged' ? 'text-yellow-400' : 'text-red-400'
                                                }`}>
                                                {incident.status.toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Started</span>
                                            <span className="text-white">{formatDateTime(incident.started_at)}</span>
                                        </div>
                                    </div>
                                    <div className="mt-3 p-2 bg-gray-800 rounded text-sm border-t border-gray-700">
                                        <div className="text-xs text-gray-500 mb-1">Trigger</div>
                                        <p className="text-gray-300">{incident.trigger_reason}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right: Timeline */}
                        <div className="lg:col-span-2">
                            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                                <h2 className="text-sm font-medium text-gray-400 mb-4">
                                    Incident Timeline
                                    {incident && (
                                        <span className="text-gray-600 ml-2">
                                            ({incident.timeline.length} events)
                                        </span>
                                    )}
                                </h2>

                                {(!incident || incident.timeline.length === 0) ? (
                                    <div className="text-center py-8 text-gray-500">
                                        No incident events yet. Monitoring continues.
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-[600px] overflow-y-auto">
                                        {[...incident.timeline].reverse().map((event) => (
                                            <div
                                                key={event.event_id}
                                                className={`p-3 rounded border-l-4 ${event.event_type.includes('error')
                                                    ? 'bg-red-950 border-red-500'
                                                    : event.event_type.includes('incident')
                                                        ? 'bg-yellow-950 border-yellow-500'
                                                        : event.event_type.includes('health')
                                                            ? 'bg-blue-950 border-blue-500'
                                                            : 'bg-gray-800 border-gray-600'
                                                    }`}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <span className="text-xs text-gray-400 font-mono">
                                                        {formatTime(event.timestamp)}
                                                    </span>
                                                    <span className="text-xs text-gray-500 uppercase">
                                                        {event.event_type.replace(/_/g, ' ')}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-200 mt-1">
                                                    {event.message}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <AnalysisPanel streamId={streamId} />
                )}
            </div>
        </div>
    )
}

// =============================================================================
// MAIN APP
// =============================================================================

function App() {
    const [streams, setStreams] = useState<StreamSummary[]>([])
    const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null)
    const [showAddModal, setShowAddModal] = useState(false)
    const [newStreamUrl, setNewStreamUrl] = useState('')
    const [newStreamName, setNewStreamName] = useState('')
    const [isAdding, setIsAdding] = useState(false)

    useEffect(() => {
        const fetchStreams = async () => {
            try {
                const response = await streamApi.getStreams()
                setStreams(response.data || [])
            } catch (error) {
                console.error('Error fetching streams:', error)
            }
        }

        fetchStreams()
        const interval = setInterval(fetchStreams, 2000)
        return () => clearInterval(interval)
    }, [])

    const handleAddStream = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsAdding(true)
        try {
            await streamApi.createStream(newStreamName, newStreamUrl)
            setNewStreamUrl('')
            setNewStreamName('')
            setShowAddModal(false)
            const response = await streamApi.getStreams()
            setStreams(response.data || [])
        } catch (error) {
            console.error('Error adding stream:', error)
        } finally {
            setIsAdding(false)
        }
    }

    const handleDeleteStream = async (streamId: string) => {
        if (!confirm('Delete this stream?')) return
        try {
            await streamApi.deleteStream(streamId)
            const response = await streamApi.getStreams()
            setStreams(response.data || [])
        } catch (error) {
            console.error('Error deleting stream:', error)
        }
    }

    if (selectedStreamId) {
        return (
            <InvestigationView
                streamId={selectedStreamId}
                onBack={() => setSelectedStreamId(null)}
            />
        )
    }

    const activeIncidents = streams.filter(s => s.has_active_incident).length

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            {/* Header */}
            <header className="bg-gray-900 border-b border-gray-700">
                <div className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h1 className="text-xl font-bold">HLS Stream Operations</h1>
                        <span className="text-sm text-gray-500">
                            {streams.length} stream{streams.length !== 1 ? 's' : ''}
                        </span>
                        {activeIncidents > 0 && (
                            <span className="bg-red-700 text-white text-xs font-bold px-2 py-1 rounded">
                                {activeIncidents} Active Incident{activeIncidents !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium"
                    >
                        Add Stream
                    </button>
                </div>
                <div className="px-6 pb-3 text-sm text-gray-500">
                    Monitoring Mode — Click a stream to investigate
                </div>
            </header>

            {/* Stream Grid */}
            <main className="p-6">
                {streams.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="text-5xl mb-4 text-gray-700">◉</div>
                        <h2 className="text-2xl font-semibold text-gray-300 mb-2">No Streams</h2>
                        <p className="text-gray-500 mb-6">Add an HLS stream to start monitoring</p>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium"
                        >
                            Add Your First Stream
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {streams.map((stream) => (
                            <StreamCard
                                key={stream.id}
                                stream={stream}
                                onClick={() => setSelectedStreamId(stream.id)}
                                onDelete={handleDeleteStream}
                            />
                        ))}
                    </div>
                )}
            </main>

            {/* Add Stream Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
                    <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-md">
                        <h2 className="text-xl font-semibold text-white mb-4">Add Stream</h2>
                        <form onSubmit={handleAddStream}>
                            <div className="mb-4">
                                <label className="block text-sm text-gray-400 mb-2">Stream Name</label>
                                <input
                                    type="text"
                                    value={newStreamName}
                                    onChange={(e) => setNewStreamName(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Production CDN"
                                    required
                                />
                            </div>
                            <div className="mb-6">
                                <label className="block text-sm text-gray-400 mb-2">Manifest URL</label>
                                <input
                                    type="url"
                                    value={newStreamUrl}
                                    onChange={(e) => setNewStreamUrl(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="https://cdn.example.com/stream.m3u8"
                                    required
                                />
                            </div>
                            <div className="flex gap-3 justify-end">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isAdding}
                                    className={`px-4 py-2 rounded text-white ${isAdding ? 'bg-blue-800 cursor-wait' : 'bg-blue-600 hover:bg-blue-500'
                                        }`}
                                >
                                    {isAdding ? 'Adding...' : 'Add Stream'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

export default App
