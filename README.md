# HLS Stream Operations

**A lightweight platform for monitoring HLS streams, detecting playback issues, and investigating incidents.**

**Live Demo:** [https://hls-stream-ops.onrender.com](https://hls-stream-ops.onrender.com)

---

## Overview

HLS Stream Operations helps engineers answer three critical questions:

1. **Is a stream healthy right now?**
2. **What exactly went wrong when it wasn't?**
3. **Are issues recurring over time?**

This project prioritizes clarity and practical diagnostics over exhaustive analysis. It serves as a bridge between high-level alerts and deep debugging.

---

## Core Features

### Real-Time Monitoring
Monitor HLS streams with automatic health assessment across three states:

- 🟢 **HEALTHY** - All metrics within normal ranges
- 🟡 **DEGRADED** - Performance issues detected, not yet critical
- 🔴 **UNHEALTHY** - Playback failure, requires immediate attention

Every health state includes a human-readable explanation of what triggered it.

### Automatic Incident Detection
The system creates incidents automatically when streams degrade:

- Triggered on transition to UNHEALTHY or prolonged DEGRADED state
- One active incident per stream (simplifies investigation)
- Auto-resolves when stream returns to HEALTHY

### Investigation Tools
Debug issues with the incident timeline, the primary diagnostic artifact:

- Logs every segment success/failure with timestamps
- Tracks health state transitions
- Records incident lifecycle (Opened, Acknowledged, Resolved)
- Generates thumbnails from video segments for visual context

### Root Cause Classification
Uses rule-based logic (not ML) to classify failures with confidence scores:

- **Origin/CDN Outage** - Manifest unreachable
- **Encoder/Packager Issue** - Manifest OK but segments failing
- **Network Congestion** - High latency with slow downloads
- **CDN Edge Latency** - Elevated response times
- **Intermittent Issues** - Sporadic errors without clear pattern

Every classification includes verifiable evidence.

### Analysis Mode
Historical context using rolling in-memory windows:

- Time to First Byte (TTFB) trends
- Download ratio over time
- Error rate per minute
- Health state timeline

---

## Architecture
```
┌─────────────────────────────────────────┐
│            React Frontend               │
│  Monitoring → Investigation → Analysis  │
└────────────────┬────────────────────────┘
                 │ REST API
┌────────────────▼────────────────────────┐
│           FastAPI Backend               │
│  Monitor → Health Service → Incidents   │
└─────────────────────────────────────────┘
```

**Backend:** Python 3.11, FastAPI, asyncio/aiohttp, FFmpeg  
**Frontend:** React, TypeScript, Vite, Tailwind CSS  
**Infrastructure:** Docker Compose, deployable to Render

---

## Quick Start

### Docker (Recommended)

The easiest way to run the full stack with all dependencies:
```bash
docker compose up --build
```

**Access:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Local Development

**Prerequisites:** Python 3.11+, Node 18+, FFmpeg installed

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## Usage

### Adding a Stream

Via UI or API:
```bash
curl -X POST "http://localhost:8000/api/streams?name=TestStream&manifest_url=https://example.com/master.m3u8"
```

Stream configuration is persisted to a local JSON file.

### Core API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/streams` | List all monitored streams |
| `GET` | `/api/streams/{id}` | Get stream details with health and incidents |
| `POST` | `/api/streams` | Add a new stream |
| `DELETE` | `/api/streams/{id}` | Remove a stream |
| `GET` | `/api/incidents` | List incidents (filterable) |
| `POST` | `/api/incidents/{id}/acknowledge` | Acknowledge an incident |
| `GET` | `/api/streams/{id}/metrics/history` | Get historical metrics for charts |

---

## Design Philosophy

### Three-Layer Interface

**Monitoring Mode** - Stream list with health badges. Maximum clarity, no charts.  
**Investigation Mode** - Timeline and root cause analysis for active incidents.  
**Analysis Mode** - Charts and trends for deeper investigation.

Charts are hidden by default because operators need fast diagnosis first, not more data.

### Data Strategy

- **Configuration** - Persisted to lightweight JSON file
- **Operational State** - In-memory with rolling windows
- **Health Windows** - Short 2-minute windows for quick detection
- **Analysis History** - Longer 30-60 minute windows for trend analysis

### Rule-Based Classification

Root cause analysis uses explicit rules instead of machine learning. This ensures every diagnosis is explainable and verifiable by operators.

---

## Deployment

### Render (Backend + Frontend)

**Backend Service:**
1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set root directory: `backend`
4. Set build command: `pip install -r requirements.txt`
5. Set start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
6. Add environment variable: `PORT=8000`

**Frontend Service:**
1. Create a new Web Service on Render
2. Connect the same GitHub repository
3. Set root directory: `frontend`
4. Set build command: `npm install && npm run build`
5. Set start command: (leave empty, uses Dockerfile)
6. Add environment variable: `VITE_API_URL=https://your-backend-service.onrender.com`

### VPS with Docker
```bash
docker compose up -d
```

---

## Intentional Limitations

This project focuses on reliability monitoring and incident diagnosis, not broadcast compliance:

**Excluded by design:**
- MPEG-TS deep analysis (TR-101-290)
- SCTE-35 ad marker parsing
- Audio loudness measurement
- Persistent databases (uses JSON/memory)
- Authentication or multi-tenancy

These features would add complexity without improving the core workflow.

---

## Health Check
```bash
curl http://localhost:8000/health
```

Returns system status, monitored streams count, and active incidents.

---

## Contributing

This is a focused tool with a specific scope. Before suggesting features, consider if they serve the core workflow: monitoring, detecting issues, and investigating failures.

---

## License

MIT

---

## Author

**Kushal KV**
