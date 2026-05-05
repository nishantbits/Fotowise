# ─────────────────────────────────────────────────────────────
# Stage 1: Build — compile TypeScript + React
# ─────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder

# Install native build dependencies for canvas, sharp, better-sqlite3, tfjs-node
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    pkg-config \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libpixman-1-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy manifests first (better layer caching)
COPY ./server/package*.json ./server/
COPY ./client/package*.json ./client/

# Install all server deps (including devDeps needed for tsc)
WORKDIR /app/server
RUN npm ci

# Install all client deps
WORKDIR /app/client
RUN npm ci

# Copy source code
WORKDIR /app
COPY ./client ./client
COPY ./server ./server

# Build client (Vite)
WORKDIR /app/client
RUN npm run build

# Build server (tsc)
WORKDIR /app/server
RUN npm run build

# ─────────────────────────────────────────────────────────────
# Stage 2: Production runner
# We keep native build tools because canvas / better-sqlite3 /
# sharp / tfjs-node load native .node binaries that link
# against system libraries installed here.
# ─────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runner

# Runtime-only native libraries required by our native addons
RUN apt-get update && apt-get install -y --no-install-recommends \
    # ffmpeg for video processing
    ffmpeg \
    # canvas / face-api.js dependencies
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    librsvg2-2 \
    libpixman-1-0 \
    # sharp image processing
    libvips \
    # build tools needed to compile native addons on install
    python3 \
    make \
    g++ \
    pkg-config \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libpixman-1-dev \
    # wget for healthcheck
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV LIBRARY_PATH=/app/library
ENV DB_PATH=/app/data/fotowise.db
ENV CLIP_SERVICE_URL=http://clip-service:8001

# Copy server package files and compiled output
COPY --from=builder /app/server/package*.json ./server/
COPY --from=builder /app/server/dist ./server/dist

# Install server production deps (native addons compile here)
WORKDIR /app/server
RUN npm ci --omit=dev

# Copy the compiled client assets so Express can serve them
WORKDIR /app
COPY --from=builder /app/client/dist ./client/dist

# Create volume mount points
RUN mkdir -p /app/library /app/data

EXPOSE 3000

WORKDIR /app/server
CMD ["node", "dist/index.js"]
