# 🚀 Deployment Guide

This guide provides instructions on how to deploy Fotowise for production use. Fotowise is designed to be local-first and easily deployable via Docker, but it can also be set up manually from source.

---

## 🐋 Option 1: Docker Compose (Preferred)

Running Fotowise with Docker Compose is the easiest and most reliable method. It ensures all dependencies (Node.js, FFmpeg, etc.) are correctly configured.

### Quick Start
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/fotowise.git
   cd fotowise
   ```
2. Start the container:
   ```bash
   docker compose up -d
   ```
3. Access the app at `http://localhost:3000`.

### Persistent Storage
- **Library**: `./library` stores all your media files and thumbnails.
- **Data**: `./data` stores the SQLite database.

---

## 🛠️ Option 2: Manual Setup (From Source)

If you prefer to run Fotowise without Docker, follow these steps.

### Prerequisites
- **Node.js**: v20 or higher.
- **FFmpeg**: Must be installed and available in your system's PATH (required for video processing).

### 1. Build the Frontend
```bash
cd client
npm install
npm run build
```

### 2. Setup the Backend
```bash
cd ../server
npm install
npm run build
```

### 3. Run the Server
Before running, ensure you have the necessary directories created or let the server create them automatically.
```bash
export NODE_ENV=production
npm run start
```
By default, the server will serve the frontend assets from `client/dist`.

---

## ⚙️ Environment Variables

The server can be configured using environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Public port for the server | `3000` |
| `LIBRARY_PATH` | Path to store media originals/thumbs | `./library` |
| `DB_PATH` | Path to the SQLite database file | `./data/fotowise.db` |
| `NODE_ENV` | Set to `production` for production builds | `development` |

---

## 📦 Automated Builds (CI/CD)

Fotowise includes a GitHub Action to automatically build and push Docker images to the GitHub Container Registry (GHCR) on release.

### How to use:
1. Fork this repository.
2. Create a new Release on GitHub.
3. The Action will trigger and push a new image tagged with the release version and `latest`.

---

## 🛡️ Security Note

Fotowise is designed for local use. If you plan to expose it to the internet, we strongly recommend:
1. Running it behind a reverse proxy (e.g., Nginx, Caddy, Traefik).
2. Implementing SSL (HTTPS) via Let's Encrypt.
3. Using basic auth or a VPN (like Tailscale) for access control.
