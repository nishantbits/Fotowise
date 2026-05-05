import { Router } from 'express';
import { db } from '../../db';
import { processAndClusterFaces } from '../../services/face-detector';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { config } from '../../config';

const router = Router();

// GET /api/explore/people
router.get('/', (req, res) => {
  try {
    const clusters = db.prepare(`
      SELECT 
        c.*,
        (
          SELECT GROUP_CONCAT(media_id) FROM (
            SELECT fd.media_id
            FROM face_detections fd
            JOIN media m ON fd.media_id = m.id
            WHERE fd.cluster_id = c.id AND m.is_deleted = 0
            ORDER BY fd.created_at DESC
            LIMIT 3
          )
        ) as recentMediaIds
      FROM face_clusters c
      WHERE c.photo_count > 0
      ORDER BY c.photo_count DESC
    `).all() as any[];

    let namedCount = 0;
    let unnamedCount = 0;
    let totalTaggedPhotos = 0;

    const resultClusters = clusters.map(c => {
      if (c.name) namedCount++; else unnamedCount++;
      totalTaggedPhotos += c.photo_count;

      const recentMediaIds = c.recentMediaIds ? c.recentMediaIds.split(',') : [];

      return {
        ...c,
        coverThumbnailUrl: c.cover_media_id ? `/api/media/${c.cover_media_id}/thumb/400` : null,
        recentThumbnails: recentMediaIds.map((id: string) => `/api/media/${id}/thumb/400`)
      };
    });

    res.json({
      data: {
        clusters: resultClusters,
        totalClusters: clusters.length,
        namedCount,
        unnamedCount,
        totalTaggedPhotos
      }
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/explore/people/:clusterId/photos
router.get('/:clusterId/photos', (req, res) => {
  try {
    const { clusterId } = req.params;
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

    const countRow = db.prepare('SELECT COUNT(DISTINCT m.id) as c FROM face_detections fd JOIN media m ON fd.media_id = m.id WHERE fd.cluster_id = ? AND m.is_deleted = 0').get(clusterId) as any;
    const clusterRow = db.prepare('SELECT name FROM face_clusters WHERE id = ?').get(clusterId) as any;
    
    // Join media to get photo details
    const rows = db.prepare(`
      SELECT DISTINCT m.id, m.file_name, m.file_path, m.file_size, m.mime_type, m.width, m.height, m.created_at, m.imported_at, m.blur_score, m.is_screenshot, m.is_deleted, m.is_favorite, m.exif_make, m.exif_model
      FROM face_detections fd
      JOIN media m ON fd.media_id = m.id
      WHERE fd.cluster_id = ? AND m.is_deleted = 0
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `).all(clusterId, limit, offset) as any[];

    res.json({
      clusterName: clusterRow?.name || null,
      items: rows.map(r => ({
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
        originalUrl: `/api/media/${r.id}/original`
      })),
      total: countRow.c,
      page: page,
      totalPages: Math.ceil(countRow.c / limit)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/explore/people/:clusterId
router.patch('/:clusterId', (req, res) => {
  try {
    const { clusterId } = req.params;
    const { name } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 50) {
      return res.status(400).json({ error: 'Invalid name' });
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE face_clusters SET name = ?, updated_at = ? WHERE id = ?').run(name.trim(), now, clusterId);
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/explore/people/merge
router.post('/merge', (req, res) => {
  try {
    const { sourceId, targetId } = req.body;
    if (!sourceId || !targetId) return res.status(400).json({ error: 'Missing sourceId or targetId' });

    db.exec('BEGIN TRANSACTION');
    try {
      db.prepare('UPDATE face_detections SET cluster_id = ? WHERE cluster_id = ?').run(targetId, sourceId);
      
      const countRow = db.prepare('SELECT COUNT(DISTINCT media_id) as c FROM face_detections WHERE cluster_id = ?').get(targetId) as any;
      const newCount = countRow.c;
      
      db.prepare('UPDATE face_clusters SET photo_count = ?, updated_at = ? WHERE id = ?').run(newCount, new Date().toISOString(), targetId);
      db.prepare('DELETE FROM face_clusters WHERE id = ?').run(sourceId);
      
      db.exec('COMMIT');
      res.json({ success: true });
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/explore/people/analyze
router.post('/analyze', async (req, res) => {
  try {
    res.json({ message: 'started', status: 'running' });

    setImmediate(async () => {
      const libraryRoot = config.libraryPath;
      
      const missing = db.prepare(`
        SELECT id, file_path 
        FROM media 
        WHERE is_deleted = 0 
          AND mime_type LIKE 'image/%'
          AND id NOT IN (SELECT DISTINCT media_id FROM face_detections)
      `).all() as { id: string, file_path: string }[];

      for (const media of missing) {
        const fullPath = path.join(libraryRoot, media.file_path);
        if (!fs.existsSync(fullPath)) continue;

        try {
          // Process sequentially (not parallel) due to memory constraint
          // We need width and height, but processAndClusterFaces can handle missing dimensions if we pass 0 and let canvas load it
          await processAndClusterFaces(media.id, fullPath, 0, 0);
        } catch (e) {
          console.error(`Face detect failed for ${media.id}`, e);
        }
        await new Promise(r => setTimeout(r, 10)); // Yield to event loop
      }
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
