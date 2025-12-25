"""
Incident Service - Incident Lifecycle Management

Design philosophy:
- Only ONE active incident per stream (simplifies operator mental model)
- Incidents auto-resolve when health returns to GREEN
- Timeline is the primary diagnostic artifact
- Bounded history (last 10 resolved incidents)

Key insight: Operators don't need more metrics, they need faster diagnosis.
"""

import logging
import uuid
from typing import Dict, List, Optional
from datetime import datetime

from app.models import (
    Incident, IncidentStatus, TimelineEvent, TimelineEventType,
    HealthState, StreamHealth
)

logger = logging.getLogger(__name__)


# =============================================================================
# INCIDENT LIFECYCLE MANAGEMENT
# =============================================================================

class IncidentService:
    """
    Manages incident lifecycle and timeline.
    
    Interview talking point: "I deliberately chose to allow only one
    active incident per stream. This matches how operators think - 
    they're investigating ONE problem, not multiple overlapping issues."
    """
    
    # Bounded history to prevent memory growth
    MAX_HISTORY = 10
    MAX_TIMELINE_EVENTS = 50
    
    def __init__(self):
        # stream_id -> Incident (only one active per stream)
        self.active_incidents: Dict[str, Incident] = {}
        
        # Bounded history of resolved incidents
        self.incident_history: List[Incident] = []
    
    def _generate_id(self) -> str:
        """Generate unique incident/event ID."""
        return str(uuid.uuid4())[:8]
    
    def get_active_incident(self, stream_id: str) -> Optional[Incident]:
        """Get the active incident for a stream, if any."""
        return self.active_incidents.get(stream_id)
    
    def get_incident_by_id(self, incident_id: str) -> Optional[Incident]:
        """Find incident by ID (active or historical)."""
        # Check active incidents
        for incident in self.active_incidents.values():
            if incident.incident_id == incident_id:
                return incident
        
        # Check history
        for incident in self.incident_history:
            if incident.incident_id == incident_id:
                return incident
        
        return None
    
    def get_all_incidents(
        self,
        stream_id: Optional[str] = None,
        active_only: bool = True
    ) -> List[Incident]:
        """Get incidents, optionally filtered."""
        if active_only:
            incidents = list(self.active_incidents.values())
        else:
            incidents = list(self.active_incidents.values()) + self.incident_history
        
        if stream_id:
            incidents = [i for i in incidents if i.stream_id == stream_id]
        
        # Sort by started_at, newest first
        incidents.sort(key=lambda i: i.started_at, reverse=True)
        return incidents
    
    def create_incident(
        self,
        stream_id: str,
        trigger_reason: str,
        health: StreamHealth
    ) -> Incident:
        """
        Create a new incident for a stream.
        
        Precondition: No active incident exists for this stream.
        """
        if stream_id in self.active_incidents:
            logger.warning(f"Attempted to create incident but one already exists for {stream_id}")
            return self.active_incidents[stream_id]
        
        now = datetime.utcnow()
        incident_id = f"INC-{self._generate_id()}"
        
        # Create metrics snapshot for diagnosis
        metrics_snapshot = {
            "health_state": health.state.value,
            "reason": health.reason,
            "error_count_2min": health.error_count_2min,
            "avg_ttfb_ms": health.avg_ttfb_ms,
            "avg_download_ratio": health.avg_download_ratio,
            "captured_at": now.isoformat()
        }
        
        # Initial timeline event
        initial_event = TimelineEvent(
            event_id=self._generate_id(),
            timestamp=now,
            event_type=TimelineEventType.INCIDENT_OPENED,
            message=trigger_reason,
            metadata=metrics_snapshot
        )
        
        incident = Incident(
            incident_id=incident_id,
            stream_id=stream_id,
            status=IncidentStatus.OPEN,
            trigger_reason=trigger_reason,
            started_at=now,
            metrics_snapshot=metrics_snapshot,
            timeline=[initial_event]
        )
        
        self.active_incidents[stream_id] = incident
        logger.info(f"Created incident {incident_id} for stream {stream_id}: {trigger_reason}")
        
        return incident
    
    def add_timeline_event(
        self,
        stream_id: str,
        event_type: TimelineEventType,
        message: str,
        metadata: Optional[Dict] = None,
        thumbnail_url: Optional[str] = None
    ) -> Optional[TimelineEvent]:
        """
        Add an event to the active incident's timeline.
        
        Returns None if no active incident exists.
        """
        incident = self.active_incidents.get(stream_id)
        if not incident:
            return None
        
        event = TimelineEvent(
            event_id=self._generate_id(),
            timestamp=datetime.utcnow(),
            event_type=event_type,
            message=message,
            metadata=metadata or {},
            thumbnail_url=thumbnail_url
        )
        
        incident.timeline.append(event)
        
        # Bound timeline size
        if len(incident.timeline) > self.MAX_TIMELINE_EVENTS:
            incident.timeline = incident.timeline[-self.MAX_TIMELINE_EVENTS:]
        
        return event
    
    def acknowledge_incident(self, incident_id: str) -> Optional[Incident]:
        """
        Acknowledge an incident (operator saw it, investigating).
        
        Returns the updated incident or None if not found.
        """
        for stream_id, incident in self.active_incidents.items():
            if incident.incident_id == incident_id:
                if incident.status == IncidentStatus.OPEN:
                    incident.status = IncidentStatus.ACKNOWLEDGED
                    incident.acknowledged_at = datetime.utcnow()
                    
                    self.add_timeline_event(
                        stream_id,
                        TimelineEventType.INCIDENT_ACKNOWLEDGED,
                        "Incident acknowledged by operator"
                    )
                    
                    logger.info(f"Incident {incident_id} acknowledged")
                
                return incident
        
        return None
    
    def resolve_incident(self, stream_id: str, reason: str = "Health returned to GREEN") -> Optional[Incident]:
        """
        Resolve an active incident (health recovered).
        
        Moves incident to history and clears active.
        """
        incident = self.active_incidents.get(stream_id)
        if not incident:
            return None
        
        now = datetime.utcnow()
        incident.status = IncidentStatus.RESOLVED
        incident.resolved_at = now
        
        # Add resolution event
        self.add_timeline_event(
            stream_id,
            TimelineEventType.INCIDENT_RESOLVED,
            reason
        )
        
        # Move to history
        del self.active_incidents[stream_id]
        self.incident_history.append(incident)
        
        # Bound history size
        if len(self.incident_history) > self.MAX_HISTORY:
            self.incident_history = self.incident_history[-self.MAX_HISTORY:]
        
        logger.info(f"Incident {incident.incident_id} resolved: {reason}")
        
        return incident
    
    def cleanup_stream(self, stream_id: str):
        """Remove all incident data for a stream (called on stream removal)."""
        if stream_id in self.active_incidents:
            del self.active_incidents[stream_id]
        
        # Also clean history for this stream
        self.incident_history = [
            i for i in self.incident_history 
            if i.stream_id != stream_id
        ]


# Global instance
incident_service = IncidentService()
