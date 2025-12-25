/**
 * API Service - HLS Monitoring Platform
 * 
 * Supports 3 modes:
 * - Monitoring: streams list, health summaries
 * - Investigation: incidents, timeline, root cause
 * - Analysis: metrics history, charts
 */

import axios from 'axios'

// Use environment variable for production (Render), fallback to relative paths for local dev
const API_BASE_URL = import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : '/api'

// Base URL for static files (thumbnails, etc.)
const DATA_BASE_URL = import.meta.env.VITE_API_URL || ''

// Helper to get full thumbnail URL
export const getFullUrl = (path: string | null): string | null => {
    if (!path) return null
    if (path.startsWith('http')) return path
    return `${DATA_BASE_URL}${path}`
}

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
})

// Types for API responses
export interface StreamHealth {
    state: 'green' | 'yellow' | 'red'
    reason: string
    last_updated: string
    error_count_2min: number
    avg_ttfb_ms: number
    avg_download_ratio: number
}

export interface RootCause {
    label: string
    confidence: 'low' | 'medium' | 'high'
    evidence: string[]
}

export interface StreamSummary {
    id: string
    name: string
    status: string
    health: StreamHealth
    has_active_incident: boolean
    active_incident_id: string | null
    thumbnail_url: string | null
}

export interface TimelineEvent {
    event_id: string
    timestamp: string
    event_type: string
    message: string
    metadata: Record<string, any>
    thumbnail_url: string | null
}

export interface Incident {
    incident_id: string
    stream_id: string
    status: 'open' | 'acknowledged' | 'resolved'
    trigger_reason: string
    started_at: string
    acknowledged_at: string | null
    resolved_at: string | null
    metrics_snapshot: Record<string, any>
    timeline: TimelineEvent[]
}

export interface StreamDetails {
    id: string
    name: string
    manifest_url: string
    status: string
    health: StreamHealth
    created_at: string
    root_cause: RootCause | null
    current_metrics: any | null
    active_incident: Incident | null
    recent_events: TimelineEvent[]
}

// Analysis Mode types
export interface MetricsDataPoint {
    timestamp: string
    ttfb_ms: number
    download_ratio: number
    is_error: boolean
}

export interface HealthTimelineEntry {
    timestamp: string
    state: string
}

export interface ErrorRateEntry {
    timestamp: string
    error_count: number
}

export interface MetricsHistory {
    stream_id: string
    data_points: MetricsDataPoint[]
    health_timeline: HealthTimelineEntry[]
    error_rate_series: ErrorRateEntry[]
}

export const streamApi = {
    // Monitoring Mode
    getStreams: () => api.get<StreamSummary[]>('/streams'),
    getStream: (streamId: string) => api.get<StreamDetails>(`/streams/${streamId}`),
    createStream: (name: string, manifestUrl: string) =>
        api.post<StreamSummary>('/streams', null, {
            params: { name, manifest_url: manifestUrl }
        }),
    deleteStream: (streamId: string) => api.delete(`/streams/${streamId}`),

    // Thumbnails
    getThumbnailUrl: (streamId: string) => `/api/streams/${streamId}/thumbnail/file`,

    // Investigation Mode
    getTimeline: (streamId: string, limit = 50) =>
        api.get<TimelineEvent[]>(`/streams/${streamId}/timeline`, { params: { limit } }),

    // Analysis Mode
    getMetricsHistory: (streamId: string, minutes = 30) =>
        api.get<MetricsHistory>(`/streams/${streamId}/metrics/history`, { params: { minutes } }),
}

export const incidentApi = {
    getIncidents: (activeOnly = true, streamId?: string) =>
        api.get<Incident[]>('/incidents', {
            params: { active_only: activeOnly, stream_id: streamId }
        }),
    getIncident: (incidentId: string) =>
        api.get<Incident>(`/incidents/${incidentId}`),
    acknowledgeIncident: (incidentId: string) =>
        api.post<Incident>(`/incidents/${incidentId}/acknowledge`),
}

export const healthApi = {
    getSystemHealth: () => api.get('/health'),
}

export default api
