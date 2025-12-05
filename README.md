# HLS Monitoring System

A professional-grade HLS stream monitoring solution designed for OTT broadcasters. This system provides real-time analysis, health monitoring, and visualization of HLS streams, inspired by industry standards like Elecard Boro.

![Dashboard Preview](frontend/public/screenshot.png)

## 🚀 Features

- **Real-time Monitoring**: Track bitrate, download speed, TTFB, and sequence numbers.
- **Health Analysis**: Automated health scoring (0-100%) based on stream performance.
- **Error Detection**: Detects 404s, timeouts, manifest errors, and continuity issues.
- **Visual Timeline**: Interactive timeline with thumbnails and error events.
- **Audio Analysis**: Real-time loudness monitoring (LUFS/RMS) and audio configuration detection.
- **SCTE-35 Support**: Detection and logging of SCTE-35 ad insertion markers.
- **Multi-Stream Support**: Monitor multiple streams simultaneously in a grid view.

## 🛠️ Tech Stack

- **Backend**: Python (FastAPI), AsyncIO, FFmpeg/FFprobe
- **Frontend**: React, TypeScript, Tailwind CSS, Recharts
- **Infrastructure**: Docker, Nginx

## 🏃‍♂️ Quick Start

### Prerequisites
- Docker & Docker Compose

### Run Locally
```bash
# Clone the repository
git clone https://github.com/your-username/amagi-hls-monitor.git
cd amagi-hls-monitor

# Start the system
docker compose up --build
```

Access the dashboard at: `http://localhost:3000`

## 📝 API Documentation

The backend provides a comprehensive REST API. Once running, access the interactive docs at:
`http://localhost:8000/docs`

## 📦 Deployment

This project is Docker-ready and can be deployed to any platform supporting Docker Compose (Render, Railway, AWS ECS, DigitalOcean).

### Deploy to Render (Free)
1. Fork this repo
2. Create a new **Blueprint** on Render
3. Connect your repo
4. Deploy!

## 📄 License

MIT License
