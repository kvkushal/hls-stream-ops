# HLS Stream Operations - Deployment Guide

## TL;DR

For demo purposes:
- **Frontend**: Deploy on Vercel
- **Backend**: Deploy on Render
- **Local**: `docker compose up --build` → http://localhost:3000

---

## Prerequisites

- Docker 20.10+ and Docker Compose 2.0+
- 2 GB RAM minimum, 4 GB recommended
- FFmpeg (included in Docker image)
- Network access to HLS manifests

## Quick Deploy (Docker Compose)

### Step 1: Clone and Configure

```bash
cd c:\Users\Kush\Desktop\amagi-hls-monitor
copy .env.example .env
```

### Step 2: Build and Start

```bash
docker compose up --build -d
docker compose logs -f
```

### Step 3: Access Application

- **Frontend**: http://localhost:3000
- **API**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

### Step 4: Add Test Streams

```bash
curl -X POST "http://localhost:8000/api/streams?name=Test&manifest_url=https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8"
```

## Cloud Deployment

### Render (Recommended for Backend)

1. Create a new **Web Service**
2. Connect your GitHub repo
3. Set build command: `pip install -r requirements.txt`
4. Set start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Set environment: `Python 3`

### Vercel (Recommended for Frontend)

1. Import your repo
2. Set root directory: `frontend`
3. Add environment variable: `VITE_API_URL=https://your-backend.onrender.com`
4. Deploy

### Docker on VPS

```bash
docker compose up -d
```

## Configuration

Key settings in `.env`:

```bash
DEBUG=False
CORS_ORIGINS=["https://yourdomain.com"]
MANIFEST_POLL_INTERVAL=10
```

## Troubleshooting

```bash
# Check logs
docker compose logs api
docker compose logs frontend

# Rebuild
docker compose down
docker compose up --build
```

## Health Check

```bash
curl http://localhost:8000/health
```

Returns: streams_monitored, active_incidents, status
