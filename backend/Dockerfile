FROM python:3.11-slim

# Install system dependencies including FFmpeg for thumbnail generation
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

# Create directories for data storage
RUN mkdir -p /app/logs /app/data/thumbnails /app/data/sprites /app/data/segments

# Expose port (Render uses PORT env variable)
EXPOSE 8000

# Run with uvicorn - use PORT env variable if set (Render), default to 8000
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}