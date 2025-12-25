"""
Streams API - Stream Management Endpoints (Simplified)

Endpoints:
- GET /streams - List all streams with health summaries
- GET /streams/{id} - Get stream details with active incident
- POST /streams - Add stream
- DELETE /streams/{id} - Remove stream
- GET /streams/{id}/timeline - Recent events (last 5 min)

Removed (see implementation_plan.md):
- /sprites, /loudness, /audio-metrics, /video-metrics
- /scte35-events, /alerts (replaced by incidents)
"""

import json
import uuid
import logging
from pathlib import Path
from typing import List, Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from app.config import settings
from app.models import (
    StreamConfig, StreamSummary, StreamDetails, StreamStatus,
    TimelineEvent
)
from app.services.stream_monitor import stream_monitor
from app.services.incident_service import incident_service
from app.services.thumbnail_generator import thumbnail_generator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/streams", tags=["streams"])

# =============================================================================
# PERSISTENCE (Simple JSON file)
# =============================================================================

STREAMS_FILE = Path(settings.DATA_DIR) / "streams.json"


def save_streams():
    """Save streams to JSON file."""
    try:
        STREAMS_FILE.parent.mkdir(parents=True, exist_ok=True)
        data = [
            {
                "id": config.id,
                "name": config.name,
                "manifest_url": config.manifest_url,
                "enabled": config.enabled,
                "created_at": config.created_at.isoformat()
            }
            for config in stream_monitor.active_streams.values()
        ]
        with open(STREAMS_FILE, 'w') as f:
            json.dump(data, f, indent=2)
        logger.debug(f"Saved {len(data)} streams to persistence")
    except Exception as e:
        logger.error(f"Failed to save streams: {e}")


async def load_persisted_streams():
    """Load streams from JSON file on startup."""
    try:
        if not STREAMS_FILE.exists():
            logger.info("No persisted streams file found")
            return
        
        with open(STREAMS_FILE, 'r') as f:
            data = json.load(f)
        
        for item in data:
            # Handle old format gracefully
            created_at = item.get('created_at')
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            else:
                created_at = datetime.utcnow()
            
            config = StreamConfig(
                id=item['id'],
                name=item['name'],
                manifest_url=item['manifest_url'],
                enabled=item.get('enabled', True),
                created_at=created_at
            )
            await stream_monitor.add_stream(config)
        
        logger.info(f"Loaded {len(data)} streams from persistence")
    except Exception as e:
        logger.error(f"Failed to load streams: {e}")


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("", response_model=List[StreamSummary])
async def list_streams():
    """
    List all monitored streams with health summaries.
    
    Each stream includes:
    - Current health state (GREEN/YELLOW/RED)
    - Whether there's an active incident
    - Latest thumbnail URL
    """
    return stream_monitor.list_streams()


@router.get("/{stream_id}", response_model=StreamDetails)
async def get_stream(stream_id: str):
    """
    Get detailed information about a stream.
    
    Includes:
    - Full health information with reason
    - Active incident (if any) with timeline
    - Current segment metrics
    """
    details = stream_monitor.get_stream_details(stream_id)
    
    if not details:
        raise HTTPException(status_code=404, detail="Stream not found")
    
    return details


@router.post("", response_model=StreamSummary)
async def create_stream(name: str, manifest_url: str):
    """
    Add a new stream to monitor.
    
    The stream will start monitoring immediately.
    Health and incidents will be tracked automatically.
    """
    stream_id = str(uuid.uuid4())[:8]
    
    config = StreamConfig(
        id=stream_id,
        name=name,
        manifest_url=manifest_url,
        enabled=True,
        created_at=datetime.utcnow()
    )
    
    await stream_monitor.add_stream(config)
    save_streams()
    
    # Return initial summary
    return StreamSummary(
        id=stream_id,
        name=name,
        status=StreamStatus.STARTING,
        health=stream_monitor.health_states.get(stream_id),
        has_active_incident=False
    )


@router.delete("/{stream_id}")
async def delete_stream(stream_id: str):
    """Remove a stream from monitoring."""
    if stream_id not in stream_monitor.active_streams:
        raise HTTPException(status_code=404, detail="Stream not found")
    
    await stream_monitor.remove_stream(stream_id)
    save_streams()
    
    return {"status": "deleted", "stream_id": stream_id}


@router.get("/{stream_id}/timeline", response_model=List[TimelineEvent])
async def get_timeline(
    stream_id: str,
    limit: int = Query(50, le=100)
):
    """
    Get recent timeline events for a stream.
    
    This returns the last N events, regardless of whether
    there's an active incident. Useful for recent history.
    """
    if stream_id not in stream_monitor.active_streams:
        raise HTTPException(status_code=404, detail="Stream not found")
    
    # Get from active incident if exists
    incident = incident_service.get_active_incident(stream_id)
    if incident:
        return incident.timeline[-limit:]
    
    # Otherwise return empty (no incident = no timeline in our model)
    return []


@router.get("/{stream_id}/thumbnail")
async def get_thumbnail(stream_id: str):
    """Get the latest thumbnail URL for a stream."""
    if stream_id not in stream_monitor.active_streams:
        raise HTTPException(status_code=404, detail="Stream not found")
    
    thumb_path = thumbnail_generator.get_cached_thumbnail(stream_id)
    
    if not thumb_path:
        raise HTTPException(status_code=404, detail="No thumbnail available")
    
    return {
        "thumbnail_url": f"/data/thumbnails/{Path(thumb_path).name}",
        "stream_id": stream_id
    }


@router.get("/{stream_id}/thumbnail/file")
async def get_thumbnail_file(stream_id: str):
    """Get the thumbnail image file directly."""
    if stream_id not in stream_monitor.active_streams:
        raise HTTPException(status_code=404, detail="Stream not found")
    
    thumb_path = thumbnail_generator.get_cached_thumbnail(stream_id)
    
    if not thumb_path or not Path(thumb_path).exists():
        raise HTTPException(status_code=404, detail="No thumbnail available")
    
    return FileResponse(
        thumb_path,
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=30"}
    )


# =============================================================================
# ANALYSIS MODE ENDPOINTS
# =============================================================================

@router.get("/{stream_id}/metrics/history")
async def get_metrics_history(
    stream_id: str,
    minutes: int = Query(30, le=60)
):
    """
    Get metrics history for Analysis Mode charts.
    
    Returns time series data for:
    - TTFB over time
    - Download ratio over time
    - Error rate per minute
    - Health state changes
    
    This is the ONLY place charts should get their data.
    """
    if stream_id not in stream_monitor.active_streams:
        raise HTTPException(status_code=404, detail="Stream not found")
    
    # Get metrics from window
    if stream_id not in stream_monitor.metrics_windows:
        return {"data_points": [], "health_timeline": []}
    
    window = stream_monitor.metrics_windows[stream_id]
    metrics = list(window.metrics)
    
    # Filter to requested time range
    cutoff = datetime.utcnow() - timedelta(minutes=minutes)
    
    # Build data points
    data_points = []
    for m in metrics:
        if m.timestamp > cutoff:
            data_points.append({
                "timestamp": m.timestamp.isoformat(),
                "ttfb_ms": m.ttfb,
                "download_ratio": m.download_ratio,
                "is_error": m.is_error
            })
    
    # Build health timeline from history if available
    health_timeline = []
    if stream_id in stream_monitor.health_history:
        for entry in stream_monitor.health_history[stream_id]:
            if entry["timestamp"] > cutoff:
                health_timeline.append({
                    "timestamp": entry["timestamp"].isoformat(),
                    "state": entry["state"]
                })
    
    # Calculate error rate per minute
    error_counts_by_minute = {}
    for m in metrics:
        if m.timestamp > cutoff and m.is_error:
            minute_key = m.timestamp.replace(second=0, microsecond=0).isoformat()
            error_counts_by_minute[minute_key] = error_counts_by_minute.get(minute_key, 0) + 1
    
    error_rate_series = [
        {"timestamp": ts, "error_count": count}
        for ts, count in sorted(error_counts_by_minute.items())
    ]
    
    return {
        "stream_id": stream_id,
        "data_points": data_points,
        "health_timeline": health_timeline,
        "error_rate_series": error_rate_series
    }
