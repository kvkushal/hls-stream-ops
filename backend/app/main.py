"""
Stream Failure Analysis & Incident Investigation Tool - FastAPI Application

Refactored from over-scoped monitoring platform to focused incident tool.
See implementation_plan.md for design decisions.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import logging
from pathlib import Path

from app.config import settings
from app.api import streams, websocket, health
from app.api import incidents  # NEW: Incident endpoints
from app.services.stream_monitor import stream_monitor
from app.models import HealthStatus
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for startup and shutdown."""
    # Startup
    logger.info(f"Starting Stream Failure Analysis Tool v2.0.0")
    
    # Start stream monitor
    await stream_monitor.start()
    
    # Load persisted streams
    from app.api.streams import load_persisted_streams
    await load_persisted_streams()
    
    logger.info("Application started successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down application...")
    await stream_monitor.stop()
    logger.info("Application shut down")


# Create FastAPI app
app = FastAPI(
    title="Stream Failure Analysis Tool",
    version="2.0.0",
    description="Incident-driven HLS stream failure analysis for broadcast operations",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files (for serving thumbnails)
data_dir = Path(settings.DATA_DIR)
data_dir.mkdir(parents=True, exist_ok=True)
app.mount("/data", StaticFiles(directory=str(data_dir)), name="data")

# Include routers
app.include_router(streams.router)
app.include_router(incidents.router, prefix="/api", tags=["incidents"])
app.include_router(websocket.router)
app.include_router(health.router)

# Removed: export_api, webhooks_api (out of scope)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "Stream Failure Analysis Tool",
        "version": "2.0.0",
        "description": "Incident-driven HLS stream failure analysis",
        "status": "running"
    }


@app.get("/health", response_model=HealthStatus)
async def health_check():
    """Health check endpoint."""
    from app.services.incident_service import incident_service
    
    return HealthStatus(
        status="healthy",
        timestamp=datetime.utcnow(),
        version="2.0.0",
        streams_monitored=stream_monitor.get_stream_count(),
        active_incidents=len(incident_service.active_incidents)
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )
