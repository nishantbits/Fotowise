import { watch as chokidarWatch, FSWatcher } from 'chokidar';
import path from 'path';
import fs from 'fs';
import type { WebSocketServer } from 'ws';
import { processMediaFile } from './mediaService';

const SUPPORTED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif', '.heic', '.heif', '.avif',
  '.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v',
]);

let watcher: FSWatcher | undefined;
const RECENT_IMPORT_WINDOW_MS = 5000;
const recentlyImported = new Map<string, number>();

export function startWatchFolder(watchPath: string, libraryPath: string, wss: WebSocketServer): void {
  if (watcher) {
    console.log('[Watch] Stopping previous watcher...');
    watcher.close();
    watcher = undefined;
  }

  if (!watchPath || !fs.existsSync(watchPath)) {
    console.warn(`[Watch] Watch path does not exist: ${watchPath}`);
    return;
  }

  console.log(`[Watch] Monitoring: ${watchPath}`);

  watcher = chokidarWatch(watchPath, {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 500,
    },
    depth: 5,
    ignored: /(^|[/\\])\../, // ignore dotfiles
  });

  watcher.on('add', async (filePath: string) => {
    const ext = path.extname(filePath).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      return;
    }

    const now = Date.now();
    const lastImportedAt = recentlyImported.get(filePath) ?? 0;
    if (now - lastImportedAt < RECENT_IMPORT_WINDOW_MS) {
      // Ignore rapid duplicate events for the same file
      return;
    }
    recentlyImported.set(filePath, now);

    console.log(`[Watch] New file detected: ${filePath}`);

    try {
      // Create a multer-compatible file object
      const stat = fs.statSync(filePath);
      const multerFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: path.basename(filePath),
        encoding: '7bit',
        mimetype: getMimeType(ext),
        size: stat.size,
        destination: path.dirname(filePath),
        filename: path.basename(filePath),
        path: filePath,
        buffer: Buffer.alloc(0),
        stream: fs.createReadStream(filePath),
      };

      const result = await processMediaFile(multerFile, libraryPath);

      // Broadcast to WebSocket clients
      const message = JSON.stringify({
        type: 'watch_import',
        data: result,
      });
      wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(message);
        }
      });

      console.log(`[Watch] Auto-imported: ${path.basename(filePath)} → ${result.id}`);
    } catch (error) {
      console.error(`[Watch] Failed to import ${filePath}:`, error);
    }
  });

  watcher.on('error', (error: unknown) => {
    console.error('[Watch] Watcher error:', error);
  });
}

export function stopWatchFolder(): void {
  if (watcher) {
    watcher.close();
    watcher = undefined;
    console.log('[Watch] Stopped monitoring.');
  }
}

export function isWatching(): boolean {
  return watcher !== undefined;
}

function getMimeType(ext: string): string {
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.gif': 'image/gif',
    '.webp': 'image/webp', '.bmp': 'image/bmp',
    '.tiff': 'image/tiff', '.tif': 'image/tiff',
    '.heic': 'image/heic', '.heif': 'image/heif',
    '.avif': 'image/avif',
    '.mp4': 'video/mp4', '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo', '.mkv': 'video/x-matroska',
    '.webm': 'video/webm', '.m4v': 'video/x-m4v',
  };
  return mimeMap[ext] || 'application/octet-stream';
}
