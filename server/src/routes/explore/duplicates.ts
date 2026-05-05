import { Router } from 'express';
import { db } from '../../db';
import path from 'path';
import fs from 'fs';
import { scanLibraryForDuplicates } from '../../services/duplicate-detector';

const router = Router();

// GET /api/explore/duplicates
router.get('/', (req, res) => {
  try {
    const { filter = 'all', sort = 'size_desc' } = req.query;
    
    let whereClause = '';
    if (filter === 'two_copies') whereClause = 'WHERE member_count = 2';
    if (filter === 'three_plus') whereClause = 'WHERE member_count > 2';

    let orderClause = 'ORDER BY total_size_bytes DESC';
    if (sort === 'date_desc') orderClause = 'ORDER BY created_at DESC';
    if (sort === 'count_desc') orderClause = 'ORDER BY member_count DESC';

    const groups = db.prepare(`
      SELECT * FROM duplicate_groups
      ${whereClause}
      ${orderClause}
    `).all() as any[];

    // Fetch members for each group
    const populatedGroups = groups.map(g => {
      const members = db.prepare(`
        SELECT * 
        FROM media 
        WHERE file_hash = ? AND is_deleted = 0
        ORDER BY file_size DESC
      `).all(g.hash) as any[];

      const validMembers = members.map(m => ({
        id: m.id,
        file_name: m.file_name,
        file_path: m.file_path,
        file_size: m.file_size,
        mime_type: m.mime_type,
        width: m.width,
        height: m.height,
        created_at: m.created_at,
        imported_at: m.imported_at,
        blur_score: m.blur_score,
        is_screenshot: m.is_screenshot,
        is_deleted: m.is_deleted,
        is_favorite: m.is_favorite,
        exif_make: m.exif_make,
        exif_model: m.exif_model,
        thumbnailUrl: `/api/media/${m.id}/thumb/400`,
        originalUrl: `/api/media/${m.id}/original`,
        takenAt: m.created_at,
        fileSizeBytes: m.file_size,
        isBest: m.id === g.best_media_id
      }));

      return {
        groupId: g.id,
        hash: g.hash,
        copyCount: validMembers.length,
        sizePerCopy: validMembers[0]?.fileSizeBytes || 0,
        totalWastedBytes: validMembers.filter(m => !m.isBest).reduce((sum, m) => sum + (m.fileSizeBytes || 0), 0),
        members: validMembers
      };
    }).filter(g => g.members.length > 1); // Only keep groups that STILL have > 1 member

    const totalDuplicates = populatedGroups.reduce((sum, g) => sum + (g.copyCount - 1), 0);
    const totalWastedBytes = populatedGroups.reduce((sum, g) => sum + g.totalWastedBytes, 0);

    res.json({
      groups: populatedGroups,
      totalGroups: populatedGroups.length,
      totalDuplicates,
      totalWastedBytes
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/explore/duplicates/scan
router.post('/scan', async (req, res) => {
  try {
    await scanLibraryForDuplicates();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Helper to delete media by ID using soft delete
const deleteMediaBulk = (ids: string[], libraryPath: string) => {
  let deletedCount = 0;
  let freedBytes = 0;

  const getStmt = db.prepare('SELECT file_size FROM media WHERE id = ?');

  for (const id of ids) {
    const record = getStmt.get(id) as any;
    if (record) {
      try {
        const { softDeleteMedia } = require('../../services/mediaService');
        softDeleteMedia(id, libraryPath);
        freedBytes += record.file_size || 0;
        deletedCount++;
      } catch (e) {
        console.warn(`Skipped soft deleting duplicate ${id}:`, e);
      }
    }
  }
  
  return { deletedCount, freedBytes };
};

// DELETE /api/explore/duplicates/group/:groupId
router.delete('/group/:groupId', (req, res) => {
  try {
    const { groupId } = req.params;
    const group = db.prepare('SELECT hash, best_media_id FROM duplicate_groups WHERE id = ?').get(groupId) as any;
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Get all non-best members
    const copies = db.prepare('SELECT id FROM media WHERE file_hash = ? AND id != ? AND is_deleted = 0')
      .all(group.hash, group.best_media_id) as any[];
    
    const idsToDelete = copies.map(c => c.id);
    
    const libraryPath = req.app.locals.libraryPath;
    const { deletedCount, freedBytes } = deleteMediaBulk(idsToDelete, libraryPath);
    
    // Remove group since it's no longer a duplicate
    db.prepare('DELETE FROM duplicate_groups WHERE id = ?').run(groupId);

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

// DELETE /api/explore/duplicates/all
router.delete('/all', (req, res) => {
  try {
    const groups = db.prepare('SELECT id, hash, best_media_id FROM duplicate_groups').all() as any[];
    if (groups.length === 0) return res.json({ deleted: 0, freedBytes: 0 });

    const libraryPath = req.app.locals.libraryPath;
    let totalDeleted = 0;
    let totalFreed = 0;

    for (const group of groups) {
      const copies = db.prepare('SELECT id FROM media WHERE file_hash = ? AND id != ? AND is_deleted = 0')
        .all(group.hash, group.best_media_id) as any[];
      const idsToDelete = copies.map(c => c.id);
      
      const { deletedCount, freedBytes } = deleteMediaBulk(idsToDelete, libraryPath);
      totalDeleted += deletedCount;
      totalFreed += freedBytes;
      
      db.prepare('DELETE FROM duplicate_groups WHERE id = ?').run(group.id);
    }

    if (req.app.locals.wss) {
      req.app.locals.wss.clients.forEach((client: any) => {
        if (client.readyState === 1) client.send(JSON.stringify({ type: 'library:updated' }));
      });
    }

    res.json({ deleted: totalDeleted, freedBytes: totalFreed });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/explore/duplicates/set-best
router.post('/set-best', (req, res) => {
  try {
    const { groupId, mediaId } = req.body;
    db.prepare('UPDATE duplicate_groups SET best_media_id = ? WHERE id = ?').run(mediaId, groupId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
