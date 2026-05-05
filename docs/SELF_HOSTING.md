# 🏠 Self-Hosting Guide

This guide covers how to deploy Fotowise on your own infrastructure (VPS, Home Server, Synology, etc.) using Docker and Docker Compose.

## 🚀 Prerequisites

- **Docker** and **Docker Compose** installed on your system.
- Basic knowledge of the terminal.

## 📦 Deployment Steps

### 1. Create a Project Directory
Create a folder to hold your Fotowise configuration and data:
```bash
mkdir fotowise && cd fotowise
```

### 2. Create the `docker-compose.yml`
Create a file named `docker-compose.yml` and paste the following content:

```yaml
version: '3.8'

services:
  fotowise:
    image: ghcr.io/yourusername/fotowise:latest # Replace with your image name
    container_name: fotowise
    ports:
      - "3000:3000"
    volumes:
      - ./library:/app/library          # Media storage (persistent)
      - ./data:/app/data                # SQLite database (persistent)
      # Optional: Mount an existing external folder to watch for auto-imports
      # - /path/to/your/photos:/app/watch:ro
    environment:
      - PORT=3000
      - NODE_ENV=production
      - LIBRARY_PATH=/app/library
      - DB_PATH=/app/data/fotowise.db
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/status"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### 3. Launch Fotowise
Start the application in detached mode:
```bash
docker compose up -d
```

### 4. Access the Dashboard
Open your browser and navigate to:
`http://your-server-ip:3000`

---

## 🛠️ Configuration Details

### Persistent Volumes
- `./library`: This is where your photos, thumbnails, and trash are stored. **Back this up!**
- `./data`: This contains the `fotowise.db` SQLite database.

### Environment Variables
| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | The port the backend server listens on | `3000` |
| `LIBRARY_PATH` | Internal path to store media | `/app/library` |
| `DB_PATH` | Internal path to the SQLite file | `/app/data/fotowise.db` |

## 🔄 Updating Fotowise
To update to the latest version:
```bash
docker compose pull
docker compose up -d
```
