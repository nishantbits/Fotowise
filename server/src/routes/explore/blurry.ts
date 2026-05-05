import { Router } from 'express';
import { db } from '../../db';
import { scanLibraryForSharpness } from '../../services/sharpness-analyzer';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';

const router = Router();

// GET /api/explore/blurry
router.get('/', (req, res) => {
  try {
    const querySchema = z.object({
      page:   z.coerce.number().int().min(1).default(1),
      limit:  z.coerce.number().int().min(1).max(100).default(60),
    });
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.flatten() });
    }
    const { page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    // We consider anything below 30 to be blurry
    const sharpnessThreshold = 30;

    const rows = db.prepare(`
      SELECT *
      FROM media
      WHERE is_deleted = 0 
        AND is_screenshot = 0
        AND sharpness_score IS NOT NULL 
        AND sharpness_score < ?
      ORDER BY sharpness_score ASC
      LIMIT ? OFFSET ?
    `).all(sharpnessThreshold, limit, offset) as any[];

    const totalRow = db.prepare(`
      SELECT COUNT(*) as c, SUM(file_size) as s 
      FROM media 
      WHERE is_deleted = 0 AND is_screenshot = 0 AND sharpness_score IS NOT NULL AND sharpness_score < ?
    `).get(sharpnessThreshold) as any;

    // Distribution
    const distribution = {
      severe: db.prepare(`SELECT COUNT(*) as c FROM media WHERE is_deleted = 0 AND is_screenshot = 0 AND sharpness_score < 10`).get() as any,
      moderate: db.prepare(`SELECT COUNT(*) as c FROM media WHERE is_deleted = 0 AND is_screenshot = 0 AND sharpness_score >= 10 AND sharpness_score < 20`).get() as any,
      slight: db.prepare(`SELECT COUNT(*) as c FROM media WHERE is_deleted = 0 AND is_screenshot = 0 AND sharpness_score >= 20 AND sharpness_score < 30`).get() as any,
    };

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
      sharpnessScore: r.sharpness_score,
    }));

    res.json({
      items,
      total: totalRow.c || 0,
      storageBytes: totalRow.s || 0,
      distribution: {
        severe: distribution.severe.c || 0,
        moderate: distribution.moderate.c || 0,
        slight: distribution.slight.c || 0,
      },
      page,
      totalPages: Math.ceil((totalRow.c || 0) / limit)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/explore/blurry
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
          console.warn(`Skipped soft deleting blurry photo ${id}:`, e);
        }
      }
    }

    if (req.app.locals.wss) {
      req.app.locals.wss.clients.forEach((client: any) => {
        if (client.readyState === 1) client.send(JSON.stringify({ type: 'library:updated' }));
      });
    }

    res.json({ deleted: deletedCount, freedBytes });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/explore/blurry/analyze
router.post('/analyze', async (req, res) => {
  try {
    const libraryPath = req.app.locals.libraryPath;
    const count = await scanLibraryForSharpness(libraryPath);
    res.json({ success: true, count });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
