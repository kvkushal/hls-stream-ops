"""
Incidents API - Incident Investigation Endpoints

Endpoints:
- GET /incidents - List incidents (filterable)
- GET /incidents/{id} - Get incident with timeline
- POST /incidents/{id}/acknowledge - Acknowledge incident
"""

import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException

from app.models import Incident
from app.services.incident_service import incident_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/incidents", response_model=List[Incident])
async def list_incidents(
    active_only: bool = True,
    stream_id: Optional[str] = None
):
    """
    List all incidents.
    
    Query params:
    - active_only: If true (default), only return active incidents
    - stream_id: Filter by stream ID
    """
    incidents = incident_service.get_all_incidents(
        stream_id=stream_id,
        active_only=active_only
    )
    return incidents


@router.get("/incidents/{incident_id}", response_model=Incident)
async def get_incident(incident_id: str):
    """Get incident details with full timeline."""
    incident = incident_service.get_incident_by_id(incident_id)
    
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    return incident


@router.post("/incidents/{incident_id}/acknowledge", response_model=Incident)
async def acknowledge_incident(incident_id: str):
    """
    Acknowledge an incident.
    
    This marks the incident as "acknowledged" - operator is aware and investigating.
    """
    incident = incident_service.acknowledge_incident(incident_id)
    
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    return incident
