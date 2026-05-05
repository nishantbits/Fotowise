# Fotowise

**A privacy-first, self-hosted media management platform featuring local AI semantic search and a native OS filesystem bridge.**

---

Fotowise is a high-performance, private alternative to cloud-based photo services. It processes your media locally using state-of-the-art AI models, ensuring your personal memories never leave your hardware while providing advanced search and organization capabilities.

## ✨ Key Features

*   **Local AI Engine**: Real-time facial recognition, cluster-based organization, and semantic search (CLIP) that understands natural language queries like *"sunset at the beach"* or *"receipts from last June"*.
*   **Hybrid Watcher Architecture**: A unique native OS bridge (`watcher-agent.js`) that monitors your local directories in real-time, bypassing browser security sandboxes to ingest media instantly.
*   **Real-time Syncing**: Leveraging WebSockets for live progress tracking during scans and immediate UI updates when new files are detected.
*   **Microservices Design**: Fully containerized backend services for search, indexing, and media processing, ensuring high reliability and easy deployment.
*   **Privacy-First**: No external tracking, no cloud dependencies, and zero data collection. All metadata and AI embeddings are stored in a local SQLite database.

## 🏗️ Architecture

Fotowise utilizes a hybrid architecture to solve the "Browser Sandbox Problem." While the main application and AI engine run inside **Docker** for consistency and easy deployment, a lightweight **Native Host Agent** (`watcher-agent.js`) runs directly on your OS.

This agent acts as a secure bridge:
1. It monitors local file paths (e.g., `C:\Users\Name\Pictures`) that are normally inaccessible to web applications.
2. It communicates with the Dockerized backend via a local API.
3. This allows you to "Watch" any folder on your machine without manually uploading files through a browser.

## 🛠️ Tech Stack

*   **Frontend**: React, Vite, Framer Motion, Vanilla CSS
*   **Backend**: Node.js, Express, Better-SQLite3
*   **AI/ML**: CLIP (Semantic Search), Face-api.js (Clustering)
*   **Infrastructure**: Docker, Docker Compose, WebSockets
*   **Processing**: Sharp (Images), FFmpeg (Video)

## 🚀 Getting Started

Follow these steps to get your local instance of Fotowise up and running.

### Prerequisites
*   [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.
*   [Node.js](https://nodejs.org/) (v18+) for the local watcher agent.

### Setup

1.  **Configure Environment**
    Copy the example environment file and adjust any settings if needed.
    ```bash
    cp .env.example .env
    ```

2.  **Launch the Services**
    Start the containerized backend and AI engine.
    ```bash
    docker compose up -d --build
    ```

3.  **Start the Local Watcher**
    In a new terminal window, start the host-side agent to begin monitoring your folders.
    ```bash
    node watcher-agent.js
    ```

4.  **Access the App**
    Open your browser and navigate to `http://localhost:3000`. Follow the onboarding to select your first photo directory!

---

## 📜 License
Distributed under the MIT License. See `LICENSE` for more information.

---

*Built with ❤️ for privacy and performance.*
