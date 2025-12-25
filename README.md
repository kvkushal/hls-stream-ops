# HLS Stream Operations

A layered HLS stream monitoring platform with incident detection, root-cause classification, and metrics-based analysis for stream reliability.

## Design Philosophy

> "Operators don't need more metrics — they need faster diagnosis."

This system separates **detection**, **diagnosis**, and **analysis** into distinct modes:

| Mode | Purpose | UI |
|------|---------|-----|
| **Monitoring** | Is something wrong? | Stream list + health badges |
| **Investigation** | What broke and why? | Timeline + root cause |
| **Analysis** | Is this getting worse? | Charts (TTFB, errors, ratio) |

**Why charts are hidden by default**: Operators should see clarity first. Charts support investigation, they don't replace it.

**Data strategy**: Configuration is persisted via a lightweight JSON file. Operational state (metrics, health) remains in-memory with rolling windows. Health decisions use short 2-minute windows; analysis uses longer 30-60 minute history.

## Core Features

### 1. Monitoring Mode
- Stream list with HEALTHY/DEGRADED/UNHEALTHY badges
- One-line reason: "Average TTFB 720ms exceeded 500ms threshold (last 2 min)"
- Active incident indicators
- No charts — maximum clarity

### 2. Investigation Mode
- Incident timeline (primary diagnostic artifact)
- **Root cause classification** with evidence:
  - Origin/CDN Outage (High confidence)
  - Encoder/Packager Issue (Medium confidence)
  - Network Congestion (Medium confidence)
  - CDN Edge Latency (Low confidence)
- Acknowledge incident action

### 3. Analysis Mode
- TTFB over time with threshold line
- Error rate per minute
- Download ratio trend
- Health state timeline

## Root Cause Classification

Rule-based, NO ML, fully explainable:

| Pattern | Root Cause | Confidence |
|---------|------------|------------|
| Manifest unreachable | Origin/CDN Outage | High |
| Manifest OK + segment 404s | Encoder/Packager Issue | Medium |
| High TTFB + low ratio | Network Congestion | Medium |
| Just high TTFB | CDN Edge Latency | Low |
| No clear pattern | Insufficient evidence | — |

**Why rule-based**: Operators need to trust the diagnosis. Every classification has clear evidence they can verify.

## Quick Start

### TL;DR for Demo
- **Frontend**: Deploy on Vercel
- **Backend**: Deploy on Render
- **Local**: `docker compose up --build` → http://localhost:3000

### Docker
```bash
docker compose up --build
```

### Local Development
```bash
# Terminal 1: Backend
cd backend && pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend && npm install && npm run dev
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend                         │
│  Monitoring → Investigation → Analysis              │
└────────────────────────┬────────────────────────────┘
                         │ /api
┌────────────────────────▼────────────────────────────┐
│                    Backend                          │
│  Stream Monitor → Health Service → Incident Service │
└─────────────────────────────────────────────────────┘
```

## Intentional Non-Goals

| Feature | Why Excluded |
|---------|--------------|
| Database | In-memory sufficient for 1-3 streams |
| TR-101-290 | Deep MPEG-TS analysis out of scope |
| SCTE-35 parsing | Ad insertion is separate concern |
| Audio loudness | DSP accuracy is a rabbit hole |
| Authentication | Demo context only |

## API Endpoints

```
GET  /api/streams                       # List streams
GET  /api/streams/{id}                  # Details + root cause
GET  /api/streams/{id}/metrics/history  # Chart data
GET  /api/incidents                     # All incidents
POST /api/incidents/{id}/acknowledge    # Acknowledge
GET  /health                            # System health
```

## Resume Line

> Designed and built a layered HLS monitoring platform with incident detection, root-cause classification, and metrics-based analysis for stream reliability.

## License

MIT
