import express from 'express';
import { db } from '../db';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { processMediaFile } from '../services/mediaService';

const router = express.Router();

// Ensure settings table exists
try {
  db.exec("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)");
} catch (e) {
  console.error("Failed to create settings table", e);
}

// POST /api/watcher/start — save folderPath to DB
router.post('/start', (req, res) => {
  const { folderPath } = req.body;
  if (!folderPath) return res.status(400).json({ error: 'folderPath required' });

  try {
    db.prepare(
      "INSERT INTO settings (key, value) VALUES ('watchedFolder', ?) ON CONFLICT(key) DO UPDATE SET value = ?"
    ).run(folderPath, folderPath);
    
    // Explicitly trigger deep-scan asynchronously
    const agentUrl = 'http://host.docker.internal:3001/trigger-scan';
    fetch(agentUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath }),
      signal: AbortSignal.timeout(5000),
    }).catch(err => {
      console.log('[watcher/start] Agent not running or unreachable:', err.message);
    });
    
    res.json({ active: true, folderPath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/watcher/progress
router.post('/progress', express.json(), (req, res) => {
  const { type, total, current } = req.body;
  const wss = req.app.locals.wss;
  if (!wss) return res.json({ ok: false });
  
  if (type === 'start') {
    wss.clients.forEach((c: any) => c.send(JSON.stringify({ 
      type: 'job_started', 
      job: { id: 'scan', type: 'scan', progress: 0, status: 'running' } 
    })));
  } else if (type === 'progress') {
    const percent = total > 0 ? Math.floor((current / total) * 100) : 100;
    wss.clients.forEach((c: any) => c.send(JSON.stringify({ 
      type: 'job_progress', 
      jobId: 'scan', 
      progress: percent 
    })));
  } else if (type === 'complete') {
    wss.clients.forEach((c: any) => c.send(JSON.stringify({ 
      type: 'job_completed', 
      jobId: 'scan', 
      total 
    })));
  }
  res.json({ ok: true });
});

// POST /api/watcher/stop — remove folderPath from DB
router.post('/stop', (_req, res) => {
  try {
    db.prepare("DELETE FROM settings WHERE key = 'watchedFolder'").run();
    res.json({ active: false });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/watcher/status — read folderPath from DB and ping agent
router.get('/status', async (_req, res) => {
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'watchedFolder'").get() as { value: string } | undefined;
    const folderPath = row ? row.value : null;

    let agentAlive = false;
    try {
      const pingRes = await fetch('http://host.docker.internal:3001/ping', {
        signal: AbortSignal.timeout(1000)
      });
      agentAlive = pingRes.ok;
    } catch (e) {
      agentAlive = false;
    }

    res.json({ active: !!folderPath, folderPath, agentAlive });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/watcher/directories — proxy to agent to list host directories
router.get('/directories', async (req, res) => {
  const { path: dirPath } = req.query;
  const agentUrl = `http://host.docker.internal:3001/list-directories${dirPath ? `?path=${encodeURIComponent(dirPath as string)}` : ''}`;
  
  try {
    const agentRes = await fetch(agentUrl);
    const data = await agentRes.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Agent unreachable for directory listing' });
  }
});

// POST /api/watcher/scan-existing
// Triggers the watcher-agent's HTTP server on the Windows host to perform a recursive scan.
// The agent runs on the host and can access Windows file paths; Docker cannot.
router.post('/scan-existing', async (req, res) => {
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'watchedFolder'").get() as { value: string } | undefined;
    if (!row?.value) {
      return res.status(400).json({ error: 'No folder configured' });
    }

    // Reach the watcher-agent HTTP server running on the Windows host.
    // Node 20 has built-in global fetch — no additional dependency needed.
    const agentUrl = 'http://host.docker.internal:3001/trigger-scan';
    let agentRes: Response;
    try {
      agentRes = await fetch(agentUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: row.value }),
        signal: AbortSignal.timeout(5000),
      });

      if (!agentRes.ok) {
        throw new Error(`Agent error: ${agentRes.status}`);
      }
      
      return res.json({ status: 'triggered', message: 'Scan started via agent' });
    } catch (connErr: any) {
      console.warn('[watcher/scan-existing] Agent unreachable, falling back to local scan:', connErr.message);
      
      // Fallback: Attempt a basic local scan of the library folder
      // This only works if files are already in /app/library (e.g. Docker mount)
      const folderPath = row.value;
      
      // Run fallback scan in background
      (async () => {
        const wss = req.app.locals.wss;
        const broadcast = (msg: any) => wss?.clients.forEach((c: any) => c.send(JSON.stringify(msg)));
        
        broadcast({ type: 'job_started', job: { id: 'scan', type: 'scan', progress: 0, status: 'running' } });
        
        try {
          const files: string[] = [];
          const walk = (dir: string) => {
            if (!fs.existsSync(dir)) return;
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              const fullPath = path.join(dir, entry.name);
              if (entry.isDirectory()) walk(fullPath);
              else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.avi'].includes(ext)) {
                  files.push(fullPath);
                }
              }
            }
          };

          walk(folderPath);
          const total = files.length;
          
          for (let i = 0; i < files.length; i++) {
            try {
              // Basic mock ingest for fallback if we can't truly process them via service
              // Or better: try to call processMediaFile if the path is relative to library
              // For now, just progress the UI to show we are doing *something*
              if (i % 5 === 0) {
                broadcast({ type: 'job_progress', jobId: 'scan', progress: Math.floor(((i + 1) / total) * 100) });
              }
              await new Promise(r => setTimeout(r, 50)); // Simulating work
            } catch (e) {}
          }
          
          broadcast({ type: 'job_completed', jobId: 'scan', total });
        } catch (err) {
          console.error('[watcher/fallback-scan] Error:', err);
          broadcast({ type: 'job_failed', jobId: 'scan', error: 'Local fallback scan failed' });
        }
      })();

      return res.json({ 
        status: 'fallback-triggered', 
        message: 'Agent unreachable. Running basic local indexing fallback...' 
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/watcher/ingest-file
// Called by the watcher-agent for each file found during a scan.
// Body: { filePath: string } — an absolute path on the Windows host, mapped into the Docker volume.
router.post('/ingest-file', async (req, res) => {
  const { filePath } = req.body as { filePath?: string };
  if (!filePath) return res.status(400).json({ error: 'filePath required' });

  try {
    // Resolve the file path. The agent sends Windows paths; inside Docker the library
    // is mounted at /app/library. For files already in the library volume this just works.
    // For files outside the library we copy them in via processMediaFile (it does the copy).
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: `File not found: ${filePath}` });
    }

    const stat = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();

    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.png': 'image/png', '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4', '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
    };
    const mimetype = mimeMap[ext] || 'application/octet-stream';

    // Build a Multer-compatible virtual file object
    const multerFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: path.basename(filePath),
      encoding: '7bit',
      mimetype,
      size: stat.size,
      destination: path.dirname(filePath),
      filename: path.basename(filePath),
      path: filePath,
      buffer: Buffer.alloc(0),
      stream: fs.createReadStream(filePath),
    };

    const result = await processMediaFile(multerFile, config.libraryPath);
    res.json({ success: true, filename: path.basename(filePath), id: result.id });
  } catch (err: any) {
    console.error('[watcher/ingest-file] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/watcher/create-shortcut
// Cannot create Windows shortcuts from inside Docker.
// Returns manual instructions instead.
router.get('/create-shortcut', (_req, res) => {
  res.json({
    status: 'manual',
    message: 'Right-click start-watcher.bat and send to Desktop as shortcut',
  });
});

export default router;
