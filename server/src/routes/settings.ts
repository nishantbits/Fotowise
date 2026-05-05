import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { db } from '../db';
import { regenerateThumbnailsForExistingMedia } from '../services/mediaService';

const router = Router();

// ─── GET /api/settings ─── Get all settings
router.get('/', (_req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM app_settings').all() as { key: string; value: string }[];
    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    if (settings.has_completed_onboarding === undefined) {
      try {
        const watchFolderRow = db.prepare("SELECT value FROM settings WHERE key = 'watchedFolder'").get() as { value: string } | undefined;
        const mediaCountRow = db.prepare("SELECT COUNT(*) as count FROM media").get() as { count: number } | undefined;

        const hasWatchFolder = watchFolderRow && watchFolderRow.value;
        const hasMedia = mediaCountRow && mediaCountRow.count > 0;

        if (hasWatchFolder || hasMedia) {
          // Legacy user with either a watch folder or existing data: upgrade them
          db.prepare("INSERT INTO app_settings (key, value) VALUES ('has_completed_onboarding', 'true') ON CONFLICT(key) DO UPDATE SET value = 'true'").run();
          settings.has_completed_onboarding = 'true';
        } else {
          // Genuine new user
          settings.has_completed_onboarding = 'false';
        }
      } catch (err) {
        // Fallback if settings table doesn't exist yet
        settings.has_completed_onboarding = 'false';
      }
    }
    res.json(settings);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message, code: 'SETTINGS_FETCH_FAILED' });
  }
});

// ─── PUT /api/settings ─── Bulk update settings (key-value pairs)
router.put('/', (req, res) => {
  try {
    const settings = req.body as Record<string, string>;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Request body must be a JSON object of key-value pairs', code: 'INVALID_BODY' });
    }

    const upsert = db.prepare(`
      INSERT INTO app_settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    const tx = db.transaction((entries: [string, string][]) => {
      for (const [key, value] of entries) {
        upsert.run(key, String(value));
      }
    });

    tx(Object.entries(settings));
    res.json({ success: true, updated: Object.keys(settings).length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message, code: 'SETTINGS_UPDATE_FAILED' });
  }
});

// ─── GET /api/settings/storage ─── Storage breakdown by category
router.get('/storage', (req, res) => {
  try {
    const libraryPath = req.app.locals.libraryPath as string;
    
    // TRUTH OVERRIDE: If database is empty, forcedly return 0 for everything
    const mediaCountRow = db.prepare('SELECT COUNT(*) as count FROM media').get() as { count: number };
    if (mediaCountRow.count === 0) {
      return res.json({
        total: 0,
        originals: 0,
        thumbnails: 0,
        trash: 0,
        photoSize: 0,
        videoSize: 0
      });
    }

    const getDirSize = (dirPath: string): number => {
      if (!fs.existsSync(dirPath)) return 0;
      let total = 0;
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isFile()) {
          total += fs.statSync(fullPath).size;
        } else if (entry.isDirectory()) {
          total += getDirSize(fullPath);
        }
      }
      return total;
    };

    const originalsSize = getDirSize(path.join(libraryPath, 'originals'));
    const thumbnailsSize = getDirSize(path.join(libraryPath, 'thumbnails'));
    const trashSize = getDirSize(path.join(libraryPath, 'trash'));

    // Breakdown by media type from DB
    const photoSizeRow = db.prepare(
      `SELECT COALESCE(SUM(file_size), 0) as size FROM media WHERE is_deleted = 0 AND mime_type LIKE 'image/%'`
    ).get() as { size: number };
    const videoSizeRow = db.prepare(
      `SELECT COALESCE(SUM(file_size), 0) as size FROM media WHERE is_deleted = 0 AND mime_type LIKE 'video/%'`
    ).get() as { size: number };

    res.json({
      originals: originalsSize,
      thumbnails: thumbnailsSize,
      trash: trashSize,
      total: originalsSize + thumbnailsSize + trashSize,
      photoSize: photoSizeRow.size,
      videoSize: videoSizeRow.size,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message, code: 'STORAGE_STATS_FAILED' });
  }
});

// ─── POST /api/settings/export-manifest ─── Export library manifest as JSON
router.post('/export-manifest', (_req, res) => {
  try {
    const allMedia = db.prepare('SELECT * FROM media WHERE is_deleted = 0 ORDER BY created_at DESC').all();
    const allTags = db.prepare('SELECT * FROM tags').all();
    const allAlbums = db.prepare('SELECT * FROM albums').all();
    const settings = db.prepare('SELECT * FROM app_settings').all();

    const manifest = {
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      media: allMedia,
      tags: allTags,
      albums: allAlbums,
      settings,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="fotowise-manifest-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(manifest);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message, code: 'EXPORT_FAILED' });
  }
});

// ─── POST /api/settings/clear-thumbnails ─── Clear thumbnail cache
router.post('/clear-thumbnails', (req, res) => {
  try {
    const libraryPath = req.app.locals.libraryPath as string;
    const thumbDir = path.join(libraryPath, 'thumbnails');

    if (!fs.existsSync(thumbDir)) {
      return res.json({ success: true, freedBytes: 0 });
    }

    let freedBytes = 0;
    const files = fs.readdirSync(thumbDir);
    for (const file of files) {
      const filePath = path.join(thumbDir, file);
      const stat = fs.statSync(filePath);
      if (stat.isFile()) {
        freedBytes += stat.size;
        fs.unlinkSync(filePath);
      }
    }

    res.json({ success: true, freedBytes });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message, code: 'CLEAR_THUMBNAILS_FAILED' });
  }
});

// ─── POST /api/settings/rebuild-thumbnails ─── Regenerate thumbnails for existing media
router.post('/rebuild-thumbnails', async (req, res) => {
  try {
    const libraryPath = req.app.locals.libraryPath as string;
    const thumbDir = path.join(libraryPath, 'thumbnails');
    if (!fs.existsSync(thumbDir)) {
      fs.mkdirSync(thumbDir, { recursive: true });
    }

    const rows = db
      .prepare('SELECT id FROM media WHERE is_deleted = 0')
      .all() as { id: string }[];

    let updated = 0;
    for (const row of rows) {
      const ok = await regenerateThumbnailsForExistingMedia(row.id, libraryPath);
      if (ok) updated += 1;
    }

    res.json({ success: true, updated, total: rows.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message, code: 'REBUILD_THUMBNAILS_FAILED' });
  }
});

export default router;
