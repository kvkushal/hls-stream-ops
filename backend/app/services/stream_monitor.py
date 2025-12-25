"""
Stream Monitor - Core HLS Stream Monitoring Engine (Simplified)

Refactored from 752 lines to ~350 lines.

Kept:
- Manifest fetching and parsing
- Segment downloading with TTFB/download time measurement
- FFprobe for segment duration
- Thumbnail generation (best-effort)
- Health state computation
- Incident detection

Removed (intentionally - see implementation_plan.md):
- TS analyzer (TR-101-290) 
- Loudness analyzer (audio DSP)
- Sprite generator
- Ad detector (SCTE-35)
- Complex health scoring (replaced with simple 3-state)
"""

import asyncio
import aiohttp
import time
import logging
import re
import json
from pathlib import Path
from typing import Dict, List, Optional, Set
from datetime import datetime, timedelta
from urllib.parse import urljoin
from collections import deque

from app.config import settings
from app.models import (
    StreamConfig, SegmentMetrics, StreamHealth, StreamStatus,
    HealthState, TimelineEventType, StreamSummary, StreamDetails
)
from app.services.health_service import health_service
from app.services.incident_service import incident_service
from app.services.thumbnail_generator import thumbnail_generator
from app.services.websocket_manager import ws_manager

logger = logging.getLogger(__name__)


# =============================================================================
# ROLLING WINDOW FOR METRICS (Last 2 minutes)
# =============================================================================

class MetricsWindow:
    """
    Rolling window of segment metrics for health computation.
    
    Design: Keep last 2 minutes of metrics for health assessment.
    Bounded to prevent memory growth.
    """
    MAX_AGE_SECONDS = 120  # 2 minutes
    MAX_ITEMS = 60  # ~60 segments in 2 min at 2s segments
    
    def __init__(self):
        self.metrics: deque = deque(maxlen=self.MAX_ITEMS)
    
    def add(self, metric: SegmentMetrics):
        self.metrics.append(metric)
    
    def get_recent(self) -> List[SegmentMetrics]:
        """Get metrics from last 2 minutes."""
        cutoff = datetime.utcnow() - timedelta(seconds=self.MAX_AGE_SECONDS)
        return [m for m in self.metrics if m.timestamp > cutoff]
    
    def get_error_count(self) -> int:
        """Count errors in window."""
        return sum(1 for m in self.get_recent() if m.is_error)
    
    def get_avg_ttfb(self) -> float:
        """Average TTFB in window (ms)."""
        recent = [m for m in self.get_recent() if not m.is_error]
        if not recent:
            return 0.0
        return sum(m.ttfb for m in recent) / len(recent)
    
    def get_avg_download_ratio(self) -> float:
        """Average download ratio in window."""
        recent = [m for m in self.get_recent() if not m.is_error]
        if not recent:
            return 1.0
        return sum(m.download_ratio for m in recent) / len(recent)


# =============================================================================
# STREAM MONITOR
# =============================================================================

class StreamMonitor:
    """
    Core HLS stream monitoring engine.
    
    Simplified to focus on:
    1. Segment fetching and metrics
    2. Health state derivation
    3. Incident detection
    4. Timeline tracking
    """
    
    def __init__(self):
        self.active_streams: Dict[str, StreamConfig] = {}
        self.monitoring_tasks: Dict[str, asyncio.Task] = {}
        self.seen_segments: Dict[str, Set[str]] = {}
        self.current_metrics: Dict[str, SegmentMetrics] = {}
        self.metrics_windows: Dict[str, MetricsWindow] = {}
        self.health_states: Dict[str, StreamHealth] = {}
        self.previous_states: Dict[str, HealthState] = {}
        self.yellow_start_times: Dict[str, datetime] = {}
        self.segment_counters: Dict[str, int] = {}
        
        # Root cause tracking
        self.manifest_error_counts: Dict[str, int] = {}  # For origin outage detection
        self.consecutive_error_counts: Dict[str, int] = {}  # For encoder issue detection
        
        # Metrics history for Analysis Mode charts (last 60 min)
        self.metrics_history: Dict[str, deque] = {}  # stream_id -> deque of (timestamp, ttfb, ratio, error_count)
        self.health_history: Dict[str, deque] = {}  # stream_id -> deque of (timestamp, state)
        self.HISTORY_MAX_ITEMS = 360  # ~60 min at 10s intervals
        
        self.segments_dir = Path(settings.SEGMENTS_DIR)
        self.segments_dir.mkdir(parents=True, exist_ok=True)
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def start(self):
        """Initialize the monitor."""
        self.session = aiohttp.ClientSession()
        logger.info("StreamMonitor started (simplified version)")
    
    async def stop(self):
        """Cleanup the monitor."""
        for task in self.monitoring_tasks.values():
            task.cancel()
        
        if self.session:
            await self.session.close()
        
        logger.info("StreamMonitor stopped")
    
    async def add_stream(self, stream_config: StreamConfig):
        """Add a stream to monitor."""
        stream_id = stream_config.id
        
        if stream_id in self.active_streams:
            logger.warning(f"Stream {stream_id} already being monitored")
            return
        
        self.active_streams[stream_id] = stream_config
        self.seen_segments[stream_id] = set()
        self.metrics_windows[stream_id] = MetricsWindow()
        self.health_states[stream_id] = StreamHealth()
        self.previous_states[stream_id] = HealthState.GREEN
        self.segment_counters[stream_id] = 0
        
        # Root cause tracking
        self.manifest_error_counts[stream_id] = 0
        self.consecutive_error_counts[stream_id] = 0
        
        # Metrics history for charts
        self.metrics_history[stream_id] = deque(maxlen=self.HISTORY_MAX_ITEMS)
        self.health_history[stream_id] = deque(maxlen=self.HISTORY_MAX_ITEMS)
        
        task = asyncio.create_task(self._monitor_stream(stream_config))
        self.monitoring_tasks[stream_id] = task
        
        logger.info(f"Started monitoring: {stream_config.name} ({stream_id})")
    
    async def remove_stream(self, stream_id: str):
        """Remove a stream from monitoring."""
        if stream_id not in self.active_streams:
            return
        
        if stream_id in self.monitoring_tasks:
            self.monitoring_tasks[stream_id].cancel()
            del self.monitoring_tasks[stream_id]
        
        # Cleanup all tracking data
        for store in [self.active_streams, self.seen_segments, self.metrics_windows,
                      self.health_states, self.previous_states, self.yellow_start_times,
                      self.segment_counters, self.current_metrics]:
            if stream_id in store:
                del store[stream_id]
        
        # Cleanup related services
        incident_service.cleanup_stream(stream_id)
        thumbnail_generator.cleanup_stream_thumbnails(stream_id)
        
        logger.info(f"Stopped monitoring: {stream_id}")
    
    def get_stream_count(self) -> int:
        """Get number of active streams."""
        return len(self.active_streams)
    
    def get_stream_summary(self, stream_id: str) -> Optional[StreamSummary]:
        """Get stream summary for list view."""
        config = self.active_streams.get(stream_id)
        if not config:
            return None
        
        health = self.health_states.get(stream_id, StreamHealth())
        incident = incident_service.get_active_incident(stream_id)
        thumbnail = thumbnail_generator.get_cached_thumbnail(stream_id)
        
        # Determine status based on health
        if health.state == HealthState.RED:
            status = StreamStatus.ERROR
        elif health.state == HealthState.YELLOW:
            status = StreamStatus.ONLINE
        else:
            status = StreamStatus.ONLINE
        
        return StreamSummary(
            id=stream_id,
            name=config.name,
            status=status,
            health=health,
            has_active_incident=incident is not None,
            active_incident_id=incident.incident_id if incident else None,
            thumbnail_url=f"/data/thumbnails/{Path(thumbnail).name}" if thumbnail else None
        )
    
    def get_stream_details(self, stream_id: str) -> Optional[StreamDetails]:
        """Get full stream details for investigation view."""
        config = self.active_streams.get(stream_id)
        if not config:
            return None
        
        health = self.health_states.get(stream_id, StreamHealth())
        incident = incident_service.get_active_incident(stream_id)
        current_metrics = self.current_metrics.get(stream_id)
        
        # Determine status
        if health.state == HealthState.RED:
            status = StreamStatus.ERROR
        elif health.state == HealthState.YELLOW:
            status = StreamStatus.ONLINE
        else:
            status = StreamStatus.ONLINE
        
        # Compute root cause classification
        root_cause = None
        if health.state != HealthState.GREEN:
            root_cause = health_service.classify_root_cause(
                error_count_2min=health.error_count_2min,
                avg_ttfb_ms=health.avg_ttfb_ms,
                avg_download_ratio=health.avg_download_ratio,
                manifest_errors=self.manifest_error_counts.get(stream_id, 0),
                consecutive_segment_errors=self.consecutive_error_counts.get(stream_id, 0)
            )
        
        # Get recent timeline events (even without incident)
        recent_events = []
        if incident:
            recent_events = incident.timeline[-20:]  # Last 20 events
        
        return StreamDetails(
            id=stream_id,
            name=config.name,
            manifest_url=config.manifest_url,
            status=status,
            health=health,
            created_at=config.created_at,
            root_cause=root_cause,
            current_metrics=current_metrics,
            active_incident=incident,
            recent_events=recent_events
        )
    
    def list_streams(self) -> List[StreamSummary]:
        """List all streams with summaries."""
        return [
            self.get_stream_summary(sid) 
            for sid in self.active_streams.keys()
        ]
    
    # =========================================================================
    # MONITORING LOOP
    # =========================================================================
    
    async def _monitor_stream(self, stream_config: StreamConfig):
        """Main monitoring loop for a stream."""
        stream_id = stream_config.id
        current_url = stream_config.manifest_url
        
        while True:
            try:
                manifest_content = await self._fetch_manifest(current_url)
                
                if manifest_content:
                    # Update to ONLINE if we were in error/starting
                    variants, segments = self._parse_manifest(manifest_content, current_url)
                    
                    # Handle Master Playlist - drill down to variant
                    if not segments and variants:
                        best_variant = max(variants, key=lambda x: x.get('bandwidth', 0))
                        current_url = best_variant['uri']
                        continue
                    
                    # Process new segments
                    for segment_url in segments:
                        if segment_url not in self.seen_segments[stream_id]:
                            self.seen_segments[stream_id].add(segment_url)
                            asyncio.create_task(self._process_segment(stream_id, segment_url))
                else:
                    # Manifest fetch failed - record error
                    await self._record_error(stream_id, "Manifest fetch failed")
                
                await asyncio.sleep(settings.MANIFEST_POLL_INTERVAL)
            
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error monitoring stream {stream_id}: {e}")
                await self._record_error(stream_id, f"Monitoring error: {str(e)}")
                await asyncio.sleep(settings.MANIFEST_POLL_INTERVAL)
    
    async def _fetch_manifest(self, url: str) -> Optional[str]:
        """Fetch HLS manifest."""
        try:
            async with self.session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status == 200:
                    return await response.text()
                logger.error(f"Manifest fetch failed: HTTP {response.status}")
                return None
        except Exception as e:
            logger.error(f"Manifest fetch error: {e}")
            return None
    
    def _parse_manifest(self, content: str, base_url: str) -> tuple:
        """Parse HLS manifest to extract variants and segments."""
        lines = content.split('\n')
        variants = []
        segments = []
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            
            if line.startswith('#EXT-X-STREAM-INF:'):
                info = self._parse_stream_inf(line)
                if i + 1 < len(lines):
                    uri = lines[i + 1].strip()
                    if uri and not uri.startswith('#'):
                        info['uri'] = urljoin(base_url, uri)
                        variants.append(info)
                i += 1
            
            elif line.startswith('#EXTINF:'):
                if i + 1 < len(lines):
                    uri = lines[i + 1].strip()
                    if uri and not uri.startswith('#'):
                        segments.append(urljoin(base_url, uri))
                i += 1
            
            i += 1
        
        return variants, segments
    
    def _parse_stream_inf(self, line: str) -> dict:
        """Parse #EXT-X-STREAM-INF attributes."""
        info = {}
        
        bandwidth_match = re.search(r'BANDWIDTH=(\d+)', line)
        if bandwidth_match:
            info['bandwidth'] = int(bandwidth_match.group(1))
        
        resolution_match = re.search(r'RESOLUTION=(\d+x\d+)', line)
        if resolution_match:
            info['resolution'] = resolution_match.group(1)
        
        return info
    
    async def _process_segment(self, stream_id: str, segment_url: str):
        """Download and process a segment."""
        try:
            segment_data = await self._download_segment(segment_url)
            
            if not segment_data:
                await self._record_error(stream_id, f"Segment download failed: {segment_url}")
                return
            
            # Save segment temporarily for duration probe and thumbnail
            seq = self.segment_counters.get(stream_id, 0)
            segment_filename = f"{stream_id}_{seq}.ts"
            segment_path = self.segments_dir / segment_filename
            
            with open(segment_path, 'wb') as f:
                f.write(segment_data['content'])
            
            # Probe duration
            duration = await self._probe_duration(str(segment_path))
            if not duration:
                duration = 6.0  # Default fallback
            
            # Calculate download ratio
            download_time_sec = segment_data['download_time'] / 1000
            download_ratio = duration / download_time_sec if download_time_sec > 0 else 1.0
            
            # Create metrics
            metrics = SegmentMetrics(
                uri=segment_url,
                segment_duration=duration,
                ttfb=segment_data['ttfb'],
                download_time=segment_data['download_time'],
                download_ratio=download_ratio,
                segment_size_bytes=segment_data['size'],
                timestamp=datetime.utcnow(),
                sequence_number=seq,
                is_error=False
            )
            
            # Update tracking
            self.current_metrics[stream_id] = metrics
            self.metrics_windows[stream_id].add(metrics)
            self.segment_counters[stream_id] = seq + 1
            
            # Update health and check for incidents
            await self._update_health(stream_id)
            
            # Generate thumbnail (best-effort, don't block)
            asyncio.create_task(self._generate_thumbnail(stream_id, str(segment_path), seq))
            
            # Broadcast update
            await self._broadcast_event(stream_id, "segment_processed", {
                "sequence": seq,
                "ttfb": metrics.ttfb,
                "download_time": metrics.download_time,
                "download_ratio": metrics.download_ratio
            })
        
        except Exception as e:
            logger.error(f"Error processing segment {segment_url}: {e}")
            await self._record_error(stream_id, f"Segment processing error: {str(e)}")
    
    async def _download_segment(self, url: str) -> Optional[dict]:
        """Download segment with TTFB and timing measurement."""
        try:
            ttfb_start = time.time()
            
            async with self.session.get(
                url, 
                timeout=aiohttp.ClientTimeout(total=settings.DOWNLOAD_TIMEOUT)
            ) as response:
                if response.status != 200:
                    return None
                
                ttfb = (time.time() - ttfb_start) * 1000
                download_start = time.time()
                
                content = await response.read()
                download_time = (time.time() - download_start) * 1000
                
                return {
                    'ttfb': ttfb,
                    'download_time': download_time,
                    'size': len(content),
                    'content': content
                }
        
        except asyncio.TimeoutError:
            logger.error(f"Segment download timeout: {url}")
            return None
        except Exception as e:
            logger.error(f"Segment download error: {e}")
            return None
    
    async def _probe_duration(self, file_path: str) -> Optional[float]:
        """Use ffprobe to get segment duration."""
        try:
            process = await asyncio.create_subprocess_exec(
                'ffprobe',
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                file_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, _ = await asyncio.wait_for(process.communicate(), timeout=5.0)
            
            if process.returncode == 0:
                return float(stdout.decode().strip())
            return None
        except:
            return None
    
    async def _generate_thumbnail(self, stream_id: str, segment_path: str, sequence: int):
        """Generate thumbnail for segment (best-effort)."""
        try:
            thumbnail_path = await thumbnail_generator.generate_thumbnail_for_segment(
                stream_id, "", segment_path, sequence
            )
            
            if thumbnail_path:
                # Add to incident timeline if there's an active incident
                incident = incident_service.get_active_incident(stream_id)
                if incident:
                    relative_url = f"/data/thumbnails/{Path(thumbnail_path).name}"
                    incident_service.add_timeline_event(
                        stream_id,
                        TimelineEventType.SEGMENT_OK,
                        f"Segment {sequence} processed",
                        thumbnail_url=relative_url
                    )
        except Exception as e:
            logger.debug(f"Thumbnail generation failed: {e}")
    
    async def _record_error(self, stream_id: str, message: str):
        """Record a segment error."""
        error_metric = SegmentMetrics(
            uri="",
            segment_duration=0,
            ttfb=0,
            download_time=0,
            download_ratio=0,
            segment_size_bytes=0,
            timestamp=datetime.utcnow(),
            is_error=True,
            error_message=message
        )
        
        self.metrics_windows[stream_id].add(error_metric)
        
        # Add to incident timeline if active
        incident_service.add_timeline_event(
            stream_id,
            TimelineEventType.SEGMENT_ERROR,
            message
        )
        
        # Update health
        await self._update_health(stream_id)
        
        # Broadcast error
        await self._broadcast_event(stream_id, "error", {"message": message})
    
    async def _update_health(self, stream_id: str):
        """Update health state and check for incidents."""
        if stream_id not in self.metrics_windows:
            return
        
        window = self.metrics_windows[stream_id]
        
        # Compute metrics for health
        error_count = window.get_error_count()
        avg_ttfb = window.get_avg_ttfb()
        avg_download_ratio = window.get_avg_download_ratio()
        
        # Compute new health state
        state, reason = health_service.compute_health(
            error_count_2min=error_count,
            avg_ttfb_ms=avg_ttfb,
            avg_download_ratio=avg_download_ratio
        )
        
        # Update health record
        health = StreamHealth(
            state=state,
            reason=reason,
            last_updated=datetime.utcnow(),
            error_count_2min=error_count,
            avg_ttfb_ms=avg_ttfb,
            avg_download_ratio=avg_download_ratio
        )
        
        previous_state = self.previous_states.get(stream_id, HealthState.GREEN)
        self.health_states[stream_id] = health
        
        # Check for state changes
        if state != previous_state:
            incident_service.add_timeline_event(
                stream_id,
                TimelineEventType.HEALTH_CHANGE,
                f"Health changed from {previous_state.value.upper()} to {state.value.upper()}: {reason}"
            )
            
            # Broadcast health change
            await self._broadcast_event(stream_id, "health_change", {
                "state": state.value,
                "reason": reason,
                "previous": previous_state.value
            })
        
        # Track YELLOW duration
        if state == HealthState.YELLOW:
            if stream_id not in self.yellow_start_times:
                self.yellow_start_times[stream_id] = datetime.utcnow()
            yellow_duration = (datetime.utcnow() - self.yellow_start_times[stream_id]).total_seconds()
        else:
            self.yellow_start_times.pop(stream_id, None)
            yellow_duration = 0
        
        # Check if we should create an incident
        should_create, trigger_reason = health_service.should_create_incident(
            current_state=state,
            previous_state=previous_state,
            yellow_duration_seconds=yellow_duration
        )
        
        if should_create and not incident_service.get_active_incident(stream_id):
            incident = incident_service.create_incident(stream_id, trigger_reason, health)
            await self._broadcast_event(stream_id, "incident_created", {
                "incident_id": incident.incident_id,
                "trigger": trigger_reason
            })
        
        # Check if incident should auto-resolve
        if state == HealthState.GREEN and incident_service.get_active_incident(stream_id):
            resolved = incident_service.resolve_incident(stream_id, "Health returned to GREEN")
            if resolved:
                await self._broadcast_event(stream_id, "incident_resolved", {
                    "incident_id": resolved.incident_id
                })
        
        self.previous_states[stream_id] = state
    
    async def _broadcast_event(self, stream_id: str, event_type: str, data: dict):
        """Broadcast event via WebSocket."""
        message = {
            "type": event_type,
            "stream_id": stream_id,
            "data": data,
            "timestamp": datetime.utcnow().isoformat()
        }
        await ws_manager.broadcast(stream_id, message)


# Global instance
stream_monitor = StreamMonitor()
