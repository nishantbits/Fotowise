import { Router } from 'express';
import { db } from '../../db';
import { scanAllForScreenshots } from '../../services/screenshot-detector';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';

const router = Router();

// GET /api/explore/screenshots
router.get('/', (req, res) => {
  try {
    const querySchema = z.object({
      page:   z.coerce.number().int().min(1).default(1),
      limit:  z.coerce.number().int().min(1).max(100).default(60),
      sort:   z.enum(['date_desc', 'date_asc', 'size_desc']).default('date_desc'),
      filter: z.string().default('all'),
    });
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.flatten() });
    }
    const { page, limit, sort, filter } = parsed.data;
    const offset = (page - 1) * limit;

    let orderQuery = 'created_at DESC';
    if (sort === 'date_asc') orderQuery = 'created_at ASC';
    else if (sort === 'size_desc') orderQuery = 'file_size DESC';

    let filterQuery = 'WHERE is_deleted = 0 AND is_screenshot = 1';
    
    // Add time filter manually in code for SQLite simplicity:
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    if (filter === 'this_month') {
      filterQuery += ` AND created_at >= '${firstDayOfMonth}'`;
    } else if (filter === 'large_files') {
      filterQuery += ' AND file_size > 2097152'; // > 2MB
    }

    // Main data query
    const rows = db.prepare(`
      SELECT *
      FROM media
      ${filterQuery}
      ORDER BY ${orderQuery}
      LIMIT ? OFFSET ?
    `).all(limit, offset) as any[];

    // Count queries
    const totalRow = db.prepare(`SELECT COUNT(*) as c, SUM(file_size) as s FROM media WHERE is_deleted = 0 AND is_screenshot = 1`).get() as any;
    const oldestRow = db.prepare(`SELECT MIN(created_at) as oldest FROM media WHERE is_deleted = 0 AND is_screenshot = 1`).get() as any;
    const thisMonthRow = db.prepare(`SELECT COUNT(*) as c FROM media WHERE is_deleted = 0 AND is_screenshot = 1 AND created_at >= ?`).get(firstDayOfMonth) as any;

    const items = rows.map((r: any) => ({
      id: r.id,
      file_name: r.file_name,
      file_path: r.file_path,
      file_size: r.file_size,
      mime_type: r.mime_type,
      width: r.width,
      height: r.height,
      created_at: r.created_at,
      imported_at: r.imported_at,
      blur_score: r.blur_score,
      is_screenshot: r.is_screenshot,
      is_deleted: r.is_deleted,
      is_favorite: r.is_favorite,
      exif_make: r.exif_make,
      exif_model: r.exif_model,
      thumbnailUrl: `/api/media/${r.id}/thumb/400`,
      originalUrl: `/api/media/${r.id}/original`,
      takenAt: r.created_at,
      fileSizeBytes: r.file_size,
    }));

    res.json({
      items,
      total: totalRow.c || 0,
      storageBytes: totalRow.s || 0,
      oldestDate: oldestRow.oldest || new Date().toISOString(),
      thisMonthCount: thisMonthRow.c || 0,
      page,
      totalPages: Math.ceil((totalRow.c || 0) / limit)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/explore/screenshots
router.delete('/', (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No IDs provided' });
    }

    const libraryPath = req.app.locals.libraryPath;
    let deletedCount = 0;
    let freedBytes = 0;

    const getStmt = db.prepare('SELECT file_size FROM media WHERE id = ?');
    const { softDeleteMedia } = require('../../services/mediaService');

    for (const id of ids) {
      const record = getStmt.get(id) as any;
      if (record) {
        try {
          softDeleteMedia(id, libraryPath);
          freedBytes += record.file_size || 0;
          deletedCount++;
        } catch (e) {
          console.warn(`Skipped soft deleting screenshot ${id}:`, e);
        }
      }
    }

    // Notify clients
    if (req.app.locals.wss) {
       req.app.locals.wss.clients.forEach((client: any) => {
         if (client.readyState === 1) {
           client.send(JSON.stringify({ type: 'library:updated' }));
         }
       });
    }

    res.json({ deleted: deletedCount, freedBytes });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/explore/screenshots/keep
router.post('/keep', (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No IDs provided' });
    }

    const stmt = db.prepare('UPDATE media SET is_screenshot = 0 WHERE id = ?');
    db.transaction(() => {
      for (const id of ids) {
        stmt.run(id);
      }
    })();

    res.json({ success: true, count: ids.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/explore/screenshots/scan
router.post('/scan', (req, res) => {
  try {
    const count = scanAllForScreenshots();
    res.json({ success: true, scannedAndFound: count });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
