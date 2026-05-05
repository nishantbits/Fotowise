import { Router } from 'express';
import { db } from '../../db';

const router = Router();

const FOLDERS = [
  { id: 'nature', label: 'Nature', icon: 'Tree', tags: ['beach','mountain','forest','ocean','waterfall','sunset','sunrise','sky','lake','river'] },
  { id: 'food', label: 'Food', icon: 'Utensils', tags: ['food','meal','drink','restaurant'] },
  { id: 'travel', label: 'Travel', icon: 'Plane', tags: ['travel','vacation','city','architecture','street','landmark'] },
  { id: 'pets', label: 'Pets', icon: 'Dog', tags: ['dog','cat','bird','animal'] },
  { id: 'events', label: 'Events', icon: 'PartyPopper', tags: ['wedding','birthday party','celebration','festival','concert','graduation'] },
  { id: 'documents', label: 'Documents', icon: 'FileText', tags: ['document','receipt','bill','passport','id card','certificate','ticket','invoice'] }
];

router.get('/', (req, res) => {
  try {
    const results = FOLDERS.map(folder => {
      // Create placeholders for the IN clause
      const placeholders = folder.tags.map(() => '?').join(',');
      
      const countRow = db.prepare(`
        SELECT COUNT(DISTINCT mt.media_id) as c
        FROM media_tags mt
        JOIN tags t ON mt.tag_id = t.id
        JOIN media m ON mt.media_id = m.id
        WHERE t.name IN (${placeholders}) AND m.is_deleted = 0
      `).get(...folder.tags) as any;

      const topMedia = db.prepare(`
        SELECT DISTINCT m.id, mt.confidence
        FROM media_tags mt
        JOIN tags t ON mt.tag_id = t.id
        JOIN media m ON mt.media_id = m.id
        WHERE t.name IN (${placeholders}) AND m.is_deleted = 0
        ORDER BY mt.confidence DESC
        LIMIT 4
      `).all(...folder.tags) as any[];

      return {
        id: folder.id,
        label: folder.label,
        icon: folder.icon,
        photoCount: countRow.c,
        coverThumbnails: topMedia.map(m => `/api/media/${m.id}/thumb/400`)
      };
    });

    res.json({ data: results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:folderId/photos', (req, res) => {
  try {
    const { folderId } = req.params;
    const { page = '1', limit = '60' } = req.query;
    
    const folder = FOLDERS.find(f => f.id === folderId);
    if (!folder) return res.status(404).json({ error: 'Folder not found' });

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 60;
    const offset = (pageNum - 1) * limitNum;

    const placeholders = folder.tags.map(() => '?').join(',');

    const countRow = db.prepare(`
      SELECT COUNT(DISTINCT m.id) as c
      FROM media_tags mt
      JOIN tags t ON mt.tag_id = t.id
      JOIN media m ON mt.media_id = m.id
      WHERE t.name IN (${placeholders}) AND m.is_deleted = 0
    `).get(...folder.tags) as any;

    const rows = db.prepare(`
      SELECT m.id, m.file_name, m.file_size, m.created_at, MAX(mt.confidence) as max_conf
      FROM media m
      JOIN media_tags mt ON m.id = mt.media_id
      JOIN tags t ON mt.tag_id = t.id
      WHERE t.name IN (${placeholders}) AND m.is_deleted = 0
      GROUP BY m.id
      ORDER BY max_conf DESC, m.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...folder.tags, limitNum, offset) as any[];

    res.json({
      items: rows.map(r => ({
        id: r.id,
        filename: r.file_name,
        thumbnailUrl: `/api/media/${r.id}/thumb/400`,
        originalUrl: `/api/media/${r.id}/original`,
        takenAt: r.created_at,
        fileSizeBytes: r.file_size
      })),
      meta: {
        total: countRow.c,
        page: pageNum,
        totalPages: Math.ceil(countRow.c / limitNum)
      }
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
