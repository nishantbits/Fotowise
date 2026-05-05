import { Router } from 'express';
import { db } from '../db';
import crypto from 'crypto';

const router = Router();

// GET /api/memories - List all memories
router.get('/', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT 
        a.id, a.name as title, a.metadata,
        (SELECT COUNT(*) FROM album_media WHERE album_id = a.id) as photoCount,
        (
          SELECT GROUP_CONCAT(media_id) FROM (
            SELECT media_id FROM album_media 
            WHERE album_id = a.id 
            ORDER BY position ASC 
            LIMIT 3
          )
        ) as coverPhotos
      FROM albums a
      WHERE a.type = 'memory' 
      ORDER BY a.created_at DESC
    `).all() as any[];

    const memories = rows.map(album => {
      const metadata = album.metadata ? JSON.parse(album.metadata) : {};
      
      return {
        id: album.id,
        title: album.title,
        subtitle: metadata.subtitle || '',
        dateRange: metadata.dateRange || '',
        photoCount: album.photoCount || 0,
        coverPhotos: album.coverPhotos ? album.coverPhotos.split(',') : []
      };
    });

    res.json(memories);
  } catch (error: any) {
    res.status(500).json({ error: error.message, code: 'FETCH_MEMORIES_FAILED' });
  }
});

// GET /api/memories/:id - Get specific memory details (including photos)
router.get('/:id', (req, res) => {
  const { id } = req.params;
  try {
    const album = db.prepare(`SELECT * FROM albums WHERE id = ? AND type = 'memory'`).get(id) as any;
    if (!album) {
      return res.status(404).json({ error: 'Memory not found', code: 'NOT_FOUND' });
    }

    const metadata = album.metadata ? JSON.parse(album.metadata) : {};

    const mediaItems = db.prepare(`
      SELECT m.id, m.file_name, m.file_path, m.mime_type, m.created_at, m.file_size
      FROM media m
      JOIN album_media am ON m.id = am.media_id
      WHERE am.album_id = ?
      ORDER BY am.position ASC
    `).all(id);

    res.json({
      id: album.id,
      title: album.name,
      subtitle: metadata.subtitle || '',
      dateRange: metadata.dateRange || '',
      photos: mediaItems
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message, code: 'FETCH_MEMORY_FAILED' });
  }
});

// POST /api/memories - Create a memory
router.post('/', (req, res) => {
  const { title, subtitle, dateRange, mediaIds } = req.body;

  if (!title || !mediaIds || !Array.isArray(mediaIds) || mediaIds.length === 0) {
    return res.status(400).json({ error: 'Title and at least one media item are required', code: 'INVALID_INPUT' });
  }

  const id = `mem-${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();
  const metadata = JSON.stringify({ subtitle, dateRange });

  try {
    // Before creating, verify which media IDs actually exist to prevent FOREIGN KEY constraint errors
    const validMediaRows = db.prepare(`
      SELECT id FROM media WHERE id IN (${mediaIds.map(() => '?').join(',')})
    `).all(...mediaIds) as { id: string }[];
    
    const validMediaIds = validMediaRows.map(row => row.id);
    
    // Filter out invalid ones
    const finalMediaIds = mediaIds.filter((id: string) => validMediaIds.includes(id));
    
    if (finalMediaIds.length === 0) {
      return res.status(400).json({ error: 'All provided media items are invalid or no longer exist.', code: 'INVALID_MEDIA' });
    }

    const insertAlbum = db.prepare(`
      INSERT INTO albums (id, name, type, created_at, metadata)
      VALUES (?, ?, 'memory', ?, ?)
    `);

    const insertMedia = db.prepare(`
      INSERT INTO album_media (album_id, media_id, position)
      VALUES (?, ?, ?)
    `);

    const transaction = db.transaction(() => {
      insertAlbum.run(id, title, createdAt, metadata);
      finalMediaIds.forEach((mediaId: string, index: number) => {
        insertMedia.run(id, mediaId, index);
      });
    });

    transaction();
    res.status(201).json({ success: true, id, title });
  } catch (error: any) {
    res.status(500).json({ error: error.message, code: 'CREATE_MEMORY_FAILED' });
  }
});

// DELETE /api/memories/:id - Delete a memory
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  try {
    const album = db.prepare(`SELECT id FROM albums WHERE id = ? AND type = 'memory'`).get(id) as any;
    if (!album) {
      return res.status(404).json({ error: 'Memory not found', code: 'NOT_FOUND' });
    }
    // Cascade: delete junction rows first, then the album
    db.prepare('DELETE FROM album_media WHERE album_id = ?').run(id);
    db.prepare('DELETE FROM albums WHERE id = ?').run(id);
    res.json({ success: true, id });
  } catch (error: any) {
    res.status(500).json({ error: error.message, code: 'DELETE_MEMORY_FAILED' });
  }
});

// PUT /api/memories/:id - Update a memory
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { title, subtitle, dateRange, mediaIds } = req.body;

  if (!title || !mediaIds || !Array.isArray(mediaIds) || mediaIds.length === 0) {
    return res.status(400).json({ error: 'Title and at least one media item are required', code: 'INVALID_INPUT' });
  }

  try {
    const album = db.prepare(`SELECT id FROM albums WHERE id = ? AND type = 'memory'`).get(id) as any;
    if (!album) {
      return res.status(404).json({ error: 'Memory not found', code: 'NOT_FOUND' });
    }

    const metadata = JSON.stringify({ subtitle, dateRange });

    // Verify which media IDs actually exist
    const validMediaRows = db.prepare(`
      SELECT id FROM media WHERE id IN (${mediaIds.map(() => '?').join(',')})
    `).all(...mediaIds) as { id: string }[];
    
    const validMediaIds = validMediaRows.map(row => row.id);
    const finalMediaIds = mediaIds.filter((id: string) => validMediaIds.includes(id));

    if (finalMediaIds.length === 0) {
      return res.status(400).json({ error: 'All provided media items are invalid or no longer exist.', code: 'INVALID_MEDIA' });
    }

    const updateAlbum = db.prepare(`
      UPDATE albums SET name = ?, metadata = ? WHERE id = ?
    `);

    const deleteMedia = db.prepare(`
      DELETE FROM album_media WHERE album_id = ?
    `);

    const insertMedia = db.prepare(`
      INSERT INTO album_media (album_id, media_id, position)
      VALUES (?, ?, ?)
    `);

    const transaction = db.transaction(() => {
      // Update album details
      updateAlbum.run(title, metadata, id);
      // Remove existing media associations
      deleteMedia.run(id);
      // Insert new media associations
      finalMediaIds.forEach((mediaId: string, index: number) => {
        insertMedia.run(id, mediaId, index);
      });
    });

    transaction();
    res.json({ success: true, id, title });
  } catch (error: any) {
    res.status(500).json({ error: error.message, code: 'UPDATE_MEMORY_FAILED' });
  }
});

export default router;
