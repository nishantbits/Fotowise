'use strict';

const chokidar = require('chokidar');
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const http = require('http');

const API_BASE = 'http://localhost:3000';
const AGENT_PORT = 3001;
const POLL_INTERVAL_MS = 10_000;
const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.avi']);

let watcher = null;
let currentFolderPath = null;

// ─── Status / Upload helpers ─────────────────────────────────────────────────

async function getStatus() {
  const res = await fetch(`${API_BASE}/api/watcher/status`);
  if (!res.ok) throw new Error(`Status HTTP ${res.status}`);
  return res.json();
}

async function uploadFile(filePath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath), path.basename(filePath));

  const res = await fetch(`${API_BASE}/api/media/upload`, {
    method: 'POST',
    body: form,
    headers: form.getHeaders(),
  });

  const body = await res.json().catch(() => ({}));
  if (res.ok) {
    console.log(`[watcher-agent] ✓ Uploaded: ${filePath}`);
  } else {
    console.error(`[watcher-agent] ✗ Upload failed for ${filePath}:`, body.error || res.status);
  }
}

// ─── Scan existing folder ────────────────────────────────────────────────────

/**
 * Recursively walk a directory and return all files matching SUPPORTED_EXTENSIONS.
 */
function walkDir(dir, results = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'EACCES') {
      console.error(`[watcher-agent] 🚫 Permission Denied: ${dir}`);
    } else if (err.code === 'ENOENT') {
      console.error(`[watcher-agent] ❓ Folder Not Found: ${dir}`);
    } else {
      console.error(`[watcher-agent] ❌ Error reading dir ${dir}:`, err.message);
    }
    return results;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, results);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SUPPORTED_EXTENSIONS.has(ext)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

/**
 * Scan all existing media in folderPath and upload each file via the same
 * FormData path used by the chokidar 'add' handler.
 * Runs sequentially with a small delay to avoid overwhelming the server.
 */
async function runScan(folderPath) {
  console.log(`[watcher-agent] Starting scan of: ${folderPath}`);
  const files = walkDir(folderPath);
  console.log(`[watcher-agent] Found ${files.length} media files.`);

  try {
    await fetch(`${API_BASE}/api/watcher/progress`, {
      method: 'POST',
      body: JSON.stringify({ type: 'start', total: files.length }),
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {}

  let success = 0;
  let failed = 0;
  let processed = 0;
  
  for (const filePath of files) {
    try {
      await uploadFile(filePath);
      console.log(`[watcher-agent] Imported: ${path.basename(filePath)}`);
      success++;
    } catch (err) {
      console.error(`[watcher-agent] Error importing ${path.basename(filePath)}:`, err.message);
      failed++;
    }
    processed++;
    
    // Update progress
    if (processed % 5 === 0 || processed === files.length) {
      try {
        await fetch(`${API_BASE}/api/watcher/progress`, {
          method: 'POST',
          body: JSON.stringify({ type: 'progress', total: files.length, current: processed }),
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {}
    }
    
    // Small delay to avoid overwhelming the server
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  
  try {
    await fetch(`${API_BASE}/api/watcher/progress`, {
      method: 'POST',
      body: JSON.stringify({ type: 'complete', total: files.length }),
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {}
  
  console.log(`[watcher-agent] Scan complete. ${success} imported, ${failed} failed.`);
}

// ─── Chokidar watcher ────────────────────────────────────────────────────────

function startWatching(folderPath) {
  if (watcher && currentFolderPath === folderPath) return; // already watching same path

  if (watcher) {
    console.log(`[watcher-agent] Path changed or re-triggered. Closing old watcher on: ${currentFolderPath}`);
    watcher.close();
    watcher = null;
  }

  currentFolderPath = folderPath;
  console.log(`[watcher-agent] Starting watch on: ${folderPath}`);
  watcher = chokidar.watch(folderPath, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 2000 },
  });

  watcher.on('add', (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      console.log(`[watcher-agent] Skipped (unsupported ext): ${filePath}`);
      return;
    }
    console.log(`[watcher-agent] New file detected: ${filePath}`);
    uploadFile(filePath).catch((err) =>
      console.error(`[watcher-agent] Error uploading ${filePath}:`, err.message)
    );
  });

  watcher.on('error', (err) => console.error('[watcher-agent] Watcher error:', err.message));
}

// ─── Poll loop ───────────────────────────────────────────────────────────────

async function poll() {
  try {
    const status = await getStatus();
    if (status.active && status.folderPath) {
      startWatching(status.folderPath);
    } else {
      if (watcher) {
        console.log('[watcher-agent] Folder deactivated — closing watcher.');
        await watcher.close();
        watcher = null;
        currentFolderPath = null;
      }
      console.log(`[watcher-agent] No active folder. Retrying in ${POLL_INTERVAL_MS / 1000}s...`);
      setTimeout(poll, POLL_INTERVAL_MS);
    }
  } catch (err) {
    console.error(`[watcher-agent] Could not reach server (${err.message}). Retrying in ${POLL_INTERVAL_MS / 1000}s...`);
    setTimeout(poll, POLL_INTERVAL_MS);
  }
}

// ─── HTTP trigger server (port 3001) ────────────────────────────────────────
// Docker calls POST http://host.docker.internal:3001/trigger-scan to kick off a scan.

const triggerServer = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/trigger-scan') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      let folder = currentFolderPath;
      try {
        const parsed = JSON.parse(body);
        if (parsed.folderPath) {
          folder = parsed.folderPath;
          console.log(`[watcher-agent] Received explicit path via trigger: ${folder}`);
        }
      } catch (e) {
        // No valid JSON body, use current or fetch
      }

      if (!folder) {
        try {
          const status = await getStatus();
          if (status.active && status.folderPath) {
            folder = status.folderPath;
          }
        } catch (_) {}
      }

      if (!folder) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No folder currently being watched and no path provided' }));
        return;
      }

      // Update watcher to the new path if necessary
      startWatching(folder);

      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, folder }));
      runScan(folder).catch(console.error);
    });
    return;
  } else if (req.method === 'GET' && req.url === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, pong: true, uptime: process.uptime() }));
  } else if (req.method === 'GET' && req.url.startsWith('/list-directories')) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let dirPath = url.searchParams.get('path');

    if (!dirPath) {
      // On Windows, return drive roots if no path is provided
      if (process.platform === 'win32') {
        const drives = ['C:\\', 'D:\\', 'E:\\', 'F:\\']; // Basic common drives
        const validDrives = drives.filter(d => fs.existsSync(d));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ directories: validDrives.map(d => ({ name: d, path: d })) }));
        return;
      }
      dirPath = '/';
    }

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      const directories = entries
        .filter(entry => entry.isDirectory())
        .map(entry => ({
          name: entry.name,
          path: path.join(dirPath, entry.name)
        }));
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ directories, currentPath: dirPath }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  } else {
    res.writeHead(404);
    res.end();
  }
});

triggerServer.listen(AGENT_PORT, '0.0.0.0', () => {
  console.log(`[watcher-agent] Trigger server listening on port ${AGENT_PORT}`);
});

// ─── Startup ─────────────────────────────────────────────────────────────────

console.log('[watcher-agent] Starting Fotowise Watcher Agent...');

// If --scan flag is passed, run a scan immediately after fetching the folder path
const autoScan = process.argv.includes('--scan');

// Start the polling loop (fire-and-forget; it manages its own setTimeout chain)
poll();

// If --scan was requested, independently fetch status and trigger scan right away
if (autoScan) {
  console.log('[watcher-agent] --scan flag detected. Fetching folder path for immediate scan...');
  getStatus()
    .then((status) => {
      if (status.active && status.folderPath) {
        currentFolderPath = status.folderPath;
        console.log(`[watcher-agent] --scan: scanning ${status.folderPath}`);
        return runScan(status.folderPath);
      }
      console.log('[watcher-agent] --scan: no active folder configured, skipping immediate scan.');
    })
    .catch((err) => console.error('[watcher-agent] --scan error:', err.message));
}

