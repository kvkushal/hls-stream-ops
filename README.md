# StreamProbeX
### Incident-Driven HLS Reliability Platform

A reliability-focused system for detecting, classifying, and investigating HLS stream failures in real time.

Unlike traditional monitoring dashboards that focus on charts and metrics, StreamProbeX is built around the operator workflow: detect → investigate → resolve.

**Live Demo:** https://hls-stream-ops.onrender.com

---

## Why This Exists

Monitoring tools answer:

> “Is it up?”

Reliability systems answer:

> “What failed? Why? Is it recurring?”

StreamProbeX is designed around that second question.

This project explores how live video platforms can move from metric-heavy dashboards to incident-driven diagnostics that prioritize clarity, explainability, and fast root cause isolation.

---

## What Makes This Different

This is not just an HLS monitor.

It models a simplified version of a real video operations workflow:

- Health state transitions
- Automatic incident creation
- Timeline-based investigation
- Rule-based root cause classification
- Confidence scoring
- Minimal, operator-first interface

The goal is not more data.
The goal is better decisions.

---

## Core Design Principles

### 1. Health Is a State, Not a Score

Instead of arbitrary percentages, streams move between:

- 🟢 HEALTHY  
- 🟡 DEGRADED  
- 🔴 UNHEALTHY  

Every transition includes a human-readable explanation.

No noise. No vanity metrics.

---

### 2. Incident-Centric Architecture

Incidents are first-class objects in the system.

When a stream degrades:

- An incident is automatically created
- Timeline logging begins
- Health transitions are recorded
- Root cause is evaluated continuously
- Incident auto-resolves on recovery

This mirrors real production reliability workflows.

---

### 3. Explainable Root Cause Classification

Failures are classified using explicit rules, not machine learning.

Possible classifications:

- Origin/CDN outage
- Encoder or packaging failure
- Network congestion
- CDN edge latency
- Intermittent instability

Each diagnosis includes:

- Evidence
- Confidence level
- Supporting metrics

Every decision is auditable.

---

### 4. Three-Layer Operator Interface

Monitoring → Investigation → Analysis

**Monitoring Mode**
Stream list with health states. No charts. Maximum clarity.

**Investigation Mode**
Incident timeline with segment-level events and classification logic.

**Analysis Mode**
Trend charts for deeper context when needed.

Charts are intentionally secondary.

Diagnosis comes first.

---

## Architecture

```
React Frontend
  └─ Monitoring / Investigation / Analysis

REST API

FastAPI Backend
  ├─ Stream Monitor (async polling)
  ├─ Health Evaluation Engine
  ├─ Incident Service
  ├─ Rule-Based Classifier
  └─ Metrics Aggregation Layer
```

**Backend**
- Python 3.11
- FastAPI
- asyncio / aiohttp
- FFmpeg integration

**Frontend**
- React
- TypeScript
- Vite
- Tailwind CSS

**Infrastructure**
- Docker Compose
- Deployable to Render
- In-memory + lightweight JSON persistence

---

## Data Strategy

Designed intentionally lightweight:

- Configuration stored in JSON
- Operational state stored in rolling memory windows
- Short windows (2 min) for detection
- Longer windows (30–60 min) for trend analysis

This keeps the system responsive while preserving context.

---

## Reliability Model

The system evaluates:

- Manifest availability
- Segment download success ratio
- Time To First Byte (TTFB)
- Latency patterns
- Error density

Failures are not binary.
They are contextual.

---

## Deployment

### Docker (Recommended)
```bash
docker compose up --build
```

Frontend: http://localhost:3000  
Backend API: http://localhost:8000  
Docs: http://localhost:8000/docs  

---

## Intentional Scope

This project focuses on:

- Reliability monitoring
- Incident lifecycle modeling
- Root cause explainability
- Operator workflow design

It intentionally excludes:

- Deep MPEG-TS compliance analysis
- SCTE-35 parsing
- Persistent databases
- Multi-tenancy
- Authentication layers

The goal is architectural clarity, not broadcast compliance tooling.

---

## How This Differs From My Monitoring-Focused HLS Project

That project focused on:

- Real-time health scoring
- Metrics dashboards
- Log exports
- Stream analytics

This project focuses on:

- Incident modeling
- State transitions
- Rule-based root cause analysis
- Reliability engineering principles

Monitoring observes.
Reliability explains.

---

## Future Improvements

- Persistent event storage
- Alerting integrations (Slack, PagerDuty)
- Fault injection simulator
- Multi-stream scaling layer
- Distributed monitoring agents

---

## Author

Kushal KV  
