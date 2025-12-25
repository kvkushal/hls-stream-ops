"""
Stream Failure Analysis & Incident Investigation Tool - Data Models

Intentionally simplified from original 29 models to ~10 essential ones.
Focus: Incident detection, diagnosis, and timeline tracking.

Non-goals (documented):
- TR-101-290 MPEG-TS analysis
- SCTE-35 ad marker parsing  
- Audio loudness/LUFS metrics
- Sprite generation
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# =============================================================================
# STREAM STATUS
# =============================================================================

class StreamStatus(str, Enum):
    """Stream operational status."""
    ONLINE = "online"
    OFFLINE = "offline"
    ERROR = "error"
    STARTING = "starting"


# =============================================================================
# HEALTH MODEL (Simplified - no score, just state + reason)
# =============================================================================

class HealthState(str, Enum):
    """
    Three-state health model for explainability.
    
    Interview talking point: "Operators don't need percentages, 
    they need to know: Is it working? Is it degraded? Is it broken?"
    """
    GREEN = "green"    # Healthy - all metrics within thresholds
    YELLOW = "yellow"  # Degraded - some warnings, not yet critical
    RED = "red"        # Unhealthy - requires investigation


# =============================================================================
# ROOT CAUSE CLASSIFICATION (Rule-based, explainable)
# =============================================================================

class RootCauseConfidence(str, Enum):
    """Confidence level for root cause classification."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class RootCause(BaseModel):
    """
    Rule-based root cause classification with evidence.
    
    NO ML. Fully explainable. Interview talking point:
    "I chose rules over ML because operators need to trust the diagnosis.
    Every classification has clear evidence they can verify."
    """
    label: str  # "Network Congestion", "Origin Outage", etc.
    confidence: RootCauseConfidence
    evidence: List[str] = Field(default_factory=list)  # ["High TTFB (720ms)", "Download ratio 0.4x"]


class StreamHealth(BaseModel):
    """
    Current health state with human-readable explanation.
    
    Example:
        state: RED
        reason: "4 segment timeouts and avg TTFB > 1200ms in last 2 minutes"
    """
    state: HealthState = HealthState.GREEN
    reason: str = "Stream healthy"
    last_updated: datetime = Field(default_factory=datetime.utcnow)
    
    # Metrics snapshot for context (not for scoring, for debugging)
    error_count_2min: int = 0
    avg_ttfb_ms: float = 0.0
    avg_download_ratio: float = 1.0


# =============================================================================
# STREAM CONFIGURATION
# =============================================================================

class StreamConfig(BaseModel):
    """Stream configuration for monitoring."""
    id: str
    name: str
    manifest_url: str
    enabled: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)


# =============================================================================
# SEGMENT METRICS
# =============================================================================

class SegmentMetrics(BaseModel):
    """
    Metrics from downloading a single HLS segment.
    
    Key diagnostic values:
    - ttfb: Time to first byte (network latency indicator)
    - download_time: Total download time
    - download_ratio: download_time / segment_duration (< 1.0 = realtime OK)
    """
    uri: str
    segment_duration: float  # seconds
    ttfb: float  # milliseconds
    download_time: float  # milliseconds
    download_ratio: float  # download_time / segment_duration
    segment_size_bytes: int
    timestamp: datetime
    sequence_number: Optional[int] = None
    is_error: bool = False
    error_message: Optional[str] = None


# =============================================================================
# INCIDENT MODEL
# =============================================================================

class IncidentStatus(str, Enum):
    """Incident lifecycle states."""
    OPEN = "open"              # Just detected, needs attention
    ACKNOWLEDGED = "acknowledged"  # Operator saw it, investigating
    RESOLVED = "resolved"      # Health returned to GREEN


class TimelineEventType(str, Enum):
    """Types of events in incident timeline."""
    SEGMENT_OK = "segment_ok"
    SEGMENT_ERROR = "segment_error"
    HEALTH_CHANGE = "health_change"
    INCIDENT_OPENED = "incident_opened"
    INCIDENT_ACKNOWLEDGED = "incident_acknowledged"
    INCIDENT_RESOLVED = "incident_resolved"


class TimelineEvent(BaseModel):
    """
    Single event in incident timeline.
    
    The timeline is the primary diagnostic artifact - it answers
    "What happened before, during, and after the failure?"
    """
    event_id: str
    timestamp: datetime
    event_type: TimelineEventType
    message: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    thumbnail_url: Optional[str] = None  # Best-effort, may be None


class Incident(BaseModel):
    """
    An incident represents a period of stream unhealthiness.
    
    Design decision: Only ONE active incident per stream at any time.
    This simplifies the mental model for operators.
    
    Incidents are created when:
    - Health transitions from GREEN to RED
    - YELLOW persists beyond threshold (e.g., 2 minutes)
    """
    incident_id: str
    stream_id: str
    status: IncidentStatus = IncidentStatus.OPEN
    trigger_reason: str  # Why was this incident created?
    
    started_at: datetime
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    
    # Metrics snapshot at the moment of failure (for diagnosis)
    metrics_snapshot: Dict[str, Any] = Field(default_factory=dict)
    
    # Timeline: the primary diagnostic artifact
    # Bounded to last ~50 events to prevent memory issues
    timeline: List[TimelineEvent] = Field(default_factory=list)


# =============================================================================
# API RESPONSE MODELS
# =============================================================================

class StreamSummary(BaseModel):
    """Stream summary for list view."""
    id: str
    name: str
    status: StreamStatus
    health: StreamHealth
    has_active_incident: bool = False
    active_incident_id: Optional[str] = None
    thumbnail_url: Optional[str] = None


class StreamDetails(BaseModel):
    """Full stream details for investigation view."""
    id: str
    name: str
    manifest_url: str
    status: StreamStatus
    health: StreamHealth
    created_at: datetime
    
    # Root cause classification (rule-based)
    root_cause: Optional[RootCause] = None
    
    # Current metrics (latest segment)
    current_metrics: Optional[SegmentMetrics] = None
    
    # Active incident if any
    active_incident: Optional[Incident] = None
    
    # Recent timeline events (last 5 min, even without incident)
    recent_events: List[TimelineEvent] = Field(default_factory=list)


# =============================================================================
# METRICS HISTORY (For Analysis Mode charts)
# =============================================================================

class MetricsDataPoint(BaseModel):
    """Single data point for time series charts."""
    timestamp: datetime
    ttfb_ms: float
    download_ratio: float
    error_rate: float  # errors per minute


class MetricsHistory(BaseModel):
    """Time series data for Analysis Mode charts."""
    stream_id: str
    data_points: List[MetricsDataPoint] = Field(default_factory=list)
    health_timeline: List[Dict[str, Any]] = Field(default_factory=list)  # [{timestamp, state}]


class HealthStatus(BaseModel):
    """System health check response."""
    status: str
    timestamp: datetime
    version: str = "2.0.0"  # New version for refactored system
    streams_monitored: int = 0
    active_incidents: int = 0
