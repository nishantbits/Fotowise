import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { runMigrations } from './db';
import { runAiMigrations } from './db/migrations/002_ai_features';
import { scheduleTrashCleanup } from './services/trashCleanupService';
import { initJobTracker, getRecentJobs } from './services/JobTracker';
import { ensureModelsDownloaded } from './scripts/download-models';
import { db } from './db';
import mediaRoutes from './routes/media';
import searchRoutes from './routes/search';
import settingsRoutes from './routes/settings';
import memoriesRoutes from './routes/memories';
import exploreRoutes from './routes/explore';
import { startWatchFolder } from './services/watchService';
import { config } from './config';
import watcherRouter from './routes/watcher';

// Ensure library structure exists
const dirsToCreate = [
  config.libraryPath,
  config.originalsPath,
  config.thumbnailsPath,
  config.trashPath,
  config.modelsPath
];

for (const dir of dirsToCreate) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const app = express();
const server = createServer(app);

// WebSocket for upload progress
const wss = new WebSocketServer({ server, path: '/ws/progress' });

// App state to pass around
app.locals.wss = wss;
app.locals.libraryPath = config.libraryPath;

// Initialise the job tracker so it can broadcast via WebSocket
initJobTracker(wss);

// Middleware
app.use(cors());
app.use(helmet({
  // Content Security Policy — restricts what resources the browser can load
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],   // needed for Vite dev
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://placehold.co"],         // blob: for canvas exports
      mediaSrc: ["'self'", "blob:"],                // blob: for video playback
      connectSrc: ["'self'", "ws://localhost:*"],   // WebSocket connection
      workerSrc: ["'self'", "blob:"],               // Service worker
    },
  },
  // Cross-Origin policies
  crossOriginEmbedderPolicy: false,   // Required for SharedArrayBuffer (canvas)
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  // Referrer
  referrerPolicy: { policy: 'no-referrer' },
  // DNS prefetch control
  dnsPrefetchControl: { allow: false },
}));

// Apply to upload endpoint only — 50 uploads per minute per IP
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 50,               // 50 requests per window
  message: { error: 'Too many uploads. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply to API generally — 500 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 500,
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/media/upload', uploadLimiter);
app.use('/api', apiLimiter);

app.use(compression());
app.use(express.json());

// Run Migrations
runMigrations();
runAiMigrations();

// Auto-cleanup trash
scheduleTrashCleanup();

// Routes
import healthRouter from './routes/health';
app.use('/api/health', healthRouter);
app.use('/api/media', mediaRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/memories', memoriesRoutes);
app.use('/api/explore', exploreRoutes);
app.use('/api/watcher', watcherRouter);

// System Reset Endpoint
app.post('/api/system/reset', (req, res) => {
  try {
    const tablesToClear = [
      'media',
      'face_clusters',
      'face_detections',
      'media_embeddings',
      'tags',
      'media_tags',
      'albums',
      'album_media',
      'bookmarks',
      'duplicate_groups',
      'jobs'
    ];

    db.exec('BEGIN TRANSACTION');
    try {
      for (const table of tablesToClear) {
        // use try-catch per table just in case one doesn't exist
        try {
          db.prepare(`DELETE FROM ${table}`).run();
        } catch (e) {
          console.warn(`Could not clear table ${table}`, e);
        }
      }

      // Defensive filesystem cleanup
      const thumbnailsPath = config.thumbnailsPath;
      const trashPath = config.trashPath;

      try {
        if (fs.existsSync(thumbnailsPath)) {
          fs.rmSync(thumbnailsPath, { recursive: true, force: true });
          fs.mkdirSync(thumbnailsPath, { recursive: true });
        }
      } catch (err) {
        console.error('Failed to clear thumbnails directory:', err);
      }

      try {
        if (fs.existsSync(trashPath)) {
          fs.rmSync(trashPath, { recursive: true, force: true });
          fs.mkdirSync(trashPath, { recursive: true });
        }
      } catch (err) {
        console.error('Failed to clear trash directory:', err);
      }

      try {
        db.prepare("DELETE FROM settings WHERE key = 'watchedFolder'").run();
      } catch (e) { }
      try {
        db.prepare("DELETE FROM app_settings WHERE key = 'has_completed_onboarding'").run();
      } catch (e) { }

      db.exec('COMMIT');
      res.json({ success: true, message: 'Factory reset complete' });
    } catch (txErr: any) {
      db.exec('ROLLBACK');
      throw txErr;
    }
  } catch (err: any) {
    console.error('Factory Reset Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Jobs endpoint — read-only, returns recent jobs for status polling fallback
app.get('/api/jobs', (_req, res) => {
  try {
    res.json({ jobs: getRecentJobs() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// Serve frontend in production (Docker environment)
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientPath));
  app.get(/(.*)/, (req, res) => {
    // Only serve index.html for non-API routes
    if (!req.path.startsWith('/api/') && !req.path.startsWith('/ws/')) {
      res.sendFile(path.join(clientPath, 'index.html'));
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  });
}

// 404 handler — catches any route that wasn't matched
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} does not exist`,
    timestamp: new Date().toISOString(),
  })
})

// Global error handler — catches any unhandled errors thrown in routes
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(`[Error] ${req.method} ${req.path}:`, err.message)

  // Don't expose internal error details in production
  const isDev = process.env.NODE_ENV === 'development'

  res.status(500).json({
    error: 'Internal Server Error',
    message: isDev ? err.message : 'Something went wrong. Check server logs.',
    timestamp: new Date().toISOString(),
  })
})

// Start Server
async function startServer() {
  await ensureModelsDownloaded();

  server.listen(config.port, () => {
    console.log(`Fotowise Server running on port ${config.port}`);
    console.log(`Media library path: ${config.libraryPath}`);

    // Verify expected directories exist or crash early
    const requiredDirs = [config.libraryPath, config.dbPath.split('/').slice(0, -1).join('/')];
    for (const dir of requiredDirs) {
      if (!fs.existsSync(dir)) {
        console.error(`[FATAL] Required directory missing: ${dir}`);
        console.error('Please ensure Docker volumes are mounted or directories are created.');
        process.exit(1);
      }
    }

  });
}

startServer().catch(console.error);

// Make it exportable for testing
export { app, server };
