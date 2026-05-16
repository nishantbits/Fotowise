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

1.  **Clone the Repository**
    Download the code to your local machine and enter the directory.
    ```bash
    git clone [https://github.com/nishantbits/Fotowise.git](https://github.com/nishantbits/Fotowise.git)
    cd Fotowise
    ```

2.  **Configure Environment**
    Copy the example environment file and define where your photos live.
    ```bash
    cp .env.example .env
    ```
    *(Note: Open the `.env` file and change `LIBRARY_PATH` to the absolute path of your photo folder. Example: `LIBRARY_PATH="C:\Users\Name\Pictures"`)*

3.  **Launch the Services**
    Start the containerized database, AI engine, and frontend UI.
    ```bash
    docker compose up -d
    ```
    *(Note: The first run will download the local AI models. This may take a few minutes depending on your internet speed.)*

4.  **Start the Watcher Agent**
    Install the required dependencies and start the file watcher to automatically detect new photos.
    ```bash
    npm install
    node watcher-agent.js
    ```

5.  **Access the Application**
    Your private photo gallery is now live! Open your web browser and navigate to: **http://localhost:3000**

---

## 🛠️ Troubleshooting

**Windows Users: "npm install" Error**
If PowerShell blocks the `npm install` command with a "running scripts is disabled" security error, you need to update your execution policy. 
Open Windows PowerShell as Administrator and run:
```bash
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 📜 License
Distributed under the MIT License. See `LICENSE` for more information.

---

*Built with ❤️ for privacy and performance.*
