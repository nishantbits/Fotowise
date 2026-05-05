import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../db';
import { processMediaFile, replaceMediaFile, softDeleteMedia } from '../services/mediaService';
import { config } from '../config';
import { z } from 'zod';

const router = Router();

// Ensure temporary upload directory exists and configure Multer for temporary upload storage
const tmpUploadDir = path.join(config.libraryPath, 'tmp');
if (!fs.existsSync(tmpUploadDir)) {
  try {
    fs.mkdirSync(tmpUploadDir, { recursive: true });
  } catch (error) {
    // If this fails, uploads will error later with a clear message
    console.error('Failed to create temporary upload directory:', error);
  }
}

const upload = multer({
  dest: tmpUploadDir,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 } // 2GB limit
});

const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'image/heic', 'image/heif', 'image/tiff', 'image/bmp',
  'image/avif',
  // Raw formats
  'image/x-canon-cr2', 'image/x-nikon-nef', 'image/x-sony-arw',
  'image/x-adobe-dng', 'image/x-raw',
  // Videos
  'video/mp4', 'video/quicktime', 'video/x-msvideo',
  'video/x-matroska', 'video/mpeg', 'video/webm',
]);

const MAX_FILE_SIZE_BYTES = parseInt(process.env.MAX_UPLOAD_SIZE_MB ?? '500') * 1024 * 1024;

// Upload endpoint
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded', code: 'NO_FILE' });
  }

  const file = req.file;
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    try { fs.unlinkSync(file.path) } catch { }
    return res.status(400).json({
      error: 'Unsupported file type',
      rejected: [file.originalname],
    });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    try { fs.unlinkSync(file.path) } catch { }
    return res.status(400).json({
      error: `File exceeds maximum size of ${process.env.MAX_UPLOAD_SIZE_MB ?? 500}MB`,
      rejected: [file.originalname],
    });
  }

  try {
    const libraryPath = req.app.locals.libraryPath;
    const mediaRecord = await processMediaFile(req.file, libraryPath);

    // Broadcast upload progress/success if needed

    res.status(201).json(mediaRecord);
  } catch (error: any) {
    console.error('Upload error:', error);
    // Cleanup temp file on error
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message || 'Internal server error', code: 'UPLOAD_FAILED' });
  }
});

// Replace endpoint (for Photo Editor)
router.put('/:id/replace', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded', code: 'NO_FILE' });
  }

  try {
    const { id } = req.params;
    const libraryPath = req.app.locals.libraryPath;
    const updateResult = await replaceMediaFile(id as string, req.file, libraryPath);

    res.status(200).json(updateResult);
  } catch (error: any) {
    console.error('Replace error:', error);
    // Cleanup temp file on error
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message || 'Internal server error', code: 'REPLACE_FAILED' });
  }
});

// Get library stats
router.get('/stats', (req, res) => {
  try {
    const mediaCountRow = db.prepare('SELECT COUNT(*) as count FROM media WHERE is_deleted = 0').get() as { count: number };
    
    // TRUTH OVERRIDE: If database is empty, forcedly return 0 for everything
    if (mediaCountRow.count === 0) {
      return res.json({
        totalSize: 0,
        screenshotCount: 0,
        blurryCount: 0,
        duplicateCount: 0,
        totalMedia: 0,
        totalVideos: 0,
        totalPhotos: 0,
        peopleClusters: 0,
        recentDocuments: 0
      });
    }

    const totalSizeRow = db.prepare('SELECT SUM(file_size) as totalSize FROM media WHERE is_deleted = 0').get() as { totalSize: number | null };
    const screenshotRow = db.prepare('SELECT COUNT(*) as count FROM media WHERE is_deleted = 0 AND is_screenshot = 1').get() as { count: number };
    const blurryRow = db.prepare('SELECT COUNT(*) as count FROM media WHERE is_deleted = 0 AND is_screenshot = 0 AND sharpness_score IS NOT NULL AND sharpness_score < 30').get() as { count: number };
    const videoCountRow = db.prepare(`SELECT COUNT(*) as count FROM media WHERE is_deleted = 0 AND mime_type LIKE 'video/%'`).get() as { count: number };
    const duplicateCountRow = db.prepare('SELECT COUNT(*) as count FROM duplicate_groups').get() as { count: number };

    let peopleClustersCount = 0;
    try {
      const pRow = db.prepare('SELECT COUNT(*) as count FROM face_clusters').get() as { count: number };
      if (pRow) peopleClustersCount = pRow.count;
    } catch (e) { }

    let documentsCount = 0;
    try {
      const dRow = db.prepare('SELECT COUNT(*) as count FROM media WHERE is_deleted = 0 AND is_document = 1').get() as { count: number };
      if (dRow) documentsCount = dRow.count;
    } catch (e) { }

    res.json({
      totalSize: totalSizeRow.totalSize || 0,
      screenshotCount: screenshotRow.count,
      blurryCount: blurryRow.count,
      duplicateCount: duplicateCountRow.count,
      totalMedia: mediaCountRow.count,
      totalVideos: videoCountRow.count,
      totalPhotos: mediaCountRow.count - videoCountRow.count,
      peopleClusters: peopleClustersCount,
      recentDocuments: documentsCount
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message, code: 'STATS_FAILED' });
  }
});

// Get media list
router.get('/', (req, res) => {
  try {
    const rawPage = Array.isArray(req.query.page) ? req.query.page[0] : req.query.page;
    const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;

    const page = rawPage ? parseInt(String(rawPage), 10) || 1 : 1;
    const limit = rawLimit ? parseInt(String(rawLimit), 10) || 50 : 50;
    const offset = (page - 1) * limit;

    const rows = db.prepare(`
      SELECT 
        id, file_name, file_path, file_size, mime_type, width, height, 
        duration_ms, created_at, imported_at, blur_score, sharpness_score,
        is_screenshot, is_favorite, perceptual_hash, is_document, document_type,
        document_confidence, custom_title, description
      FROM media 
      WHERE is_deleted = 0 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    const countRaw = db.prepare('SELECT COUNT(*) as count FROM media WHERE is_deleted = 0').get() as { count: number };

    res.json({
      data: rows,
      pagination: {
        page,
        limit,
        totalItems: countRaw.count,
        totalPages: Math.ceil(countRaw.count / limit)
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message, code: 'FETCH_FAILED' });
  }
});

// Serve Thumbnail
router.get('/:id/thumb/:size', (req, res) => {
  const { id, size } = req.params;
  const allowedSizes = ['200', '400', '800'];
  if (!allowedSizes.includes(size)) {
    return res.status(400).json({ error: 'Invalid size', code: 'INVALID_SIZE' });
  }

  const libraryPath = req.app.locals.libraryPath;
  const thumbPath = path.join(libraryPath, 'thumbnails', `${id}_${size}.webp`);

  if (!fs.existsSync(thumbPath)) {
    return res.status(404).json({ error: 'Thumbnail not found', code: 'NOT_FOUND' });
  }

  res.sendFile(thumbPath);
});

// Serve Original
router.get('/:id/original', (req, res) => {
  const { id } = req.params;

  const record = db.prepare('SELECT file_path FROM media WHERE id = ?').get(id) as { file_path: string } | undefined;

  if (!record) {
    return res.status(404).json({ error: 'Media not found', code: 'NOT_FOUND' });
  }

  const libraryPath = req.app.locals.libraryPath;
  const fullPath = path.join(libraryPath, record.file_path);

  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'File not found on disk', code: 'NOT_FOUND' });
  }

  res.sendFile(fullPath);
});

// ─── DELETE /api/media/:id ─── Soft-delete (move to trash)
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  try {
    const libraryPath = req.app.locals.libraryPath;
    softDeleteMedia(id, libraryPath);
    res.json({ success: true, id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    // If it's the "not found" error from our service, return 404
    if (message.includes('not found')) {
      return res.status(404).json({ error: message, code: 'NOT_FOUND' });
    }
    res.status(500).json({ error: message, code: 'DELETE_FAILED' });
  }
});

// ─── DELETE /api/media ─── Bulk Soft-delete
router.delete('/', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: 'ids array is required', code: 'INVALID_INPUT' });
  }

  try {
    const libraryPath = req.app.locals.libraryPath;
    let deletedCount = 0;
    for (const id of ids) {
      try {
        softDeleteMedia(id, libraryPath);
        deletedCount++;
      } catch (e) {
        console.warn(`Skipped soft deleting ${id}:`, e);
      }
    }
    res.json({ success: true, deletedCount });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message, code: 'BULK_DELETE_FAILED' });
  }
});

// ─── GET /api/media/trash ─── List trashed items
router.get('/trash/list', (_req, res) => {
  try {
    const rows = db.prepare(`
      SELECT 
        id, file_name, file_path, file_size, mime_type, width, height, 
        duration_ms, created_at, imported_at, blur_score, sharpness_score,
        is_screenshot, is_favorite, perceptual_hash, is_document, document_type,
        document_confidence, custom_title, description
      FROM media 
      WHERE is_deleted = 1 
      ORDER BY imported_at DESC
    `).all();
    res.json({ data: rows, count: rows.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message, code: 'TRASH_LIST_FAILED' });
  }
});

// ─── POST /api/media/:id/restore ─── Restore from trash
router.post('/:id/restore', (req, res) => {
  const { id } = req.params;

  try {
    const record = db.prepare('SELECT file_path, file_name FROM media WHERE id = ? AND is_deleted = 1').get(id) as { file_path: string; file_name: string } | undefined;
    if (!record) {
      return res.status(404).json({ error: 'Media not found in trash', code: 'NOT_FOUND' });
    }

    const libraryPath = req.app.locals.libraryPath;
    const trashPath = path.join(libraryPath, 'trash', `${id}${path.extname(record.file_name)}`);
    const originalFullPath = path.join(libraryPath, record.file_path);

    // Ensure parent directory exists
    const parentDir = path.dirname(originalFullPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Move file back from trash
    if (fs.existsSync(trashPath)) {
      fs.copyFileSync(trashPath, originalFullPath);
      fs.unlinkSync(trashPath);
    }

    // Mark as not deleted
    db.prepare('UPDATE media SET is_deleted = 0 WHERE id = ?').run(id);

    res.json({ success: true, id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message, code: 'RESTORE_FAILED' });
  }
});

// ─── DELETE /api/media/trash/empty ─── Permanently delete all trashed files
router.delete('/trash/empty', (req, res) => {
  try {
    const libraryPath = req.app.locals.libraryPath;
    const trashDir = path.join(libraryPath, 'trash');

    // Get all trashed media IDs for thumbnail cleanup
    const trashedItems = db.prepare('SELECT id FROM media WHERE is_deleted = 1').all() as { id: string }[];

    // Delete trash files
    if (fs.existsSync(trashDir)) {
      const files = fs.readdirSync(trashDir);
      for (const file of files) {
        const filePath = path.join(trashDir, file);
        try {
          const stat = fs.statSync(filePath);
          if (stat.isFile()) {
            fs.unlinkSync(filePath);
          }
        } catch (error: any) {
          // Ignore files that disappeared between readdir/stat/unlink
          if (error?.code !== 'ENOENT') {
            throw error;
          }
        }
      }
    }

    // Delete associated thumbnails
    const thumbDir = path.join(libraryPath, 'thumbnails');
    for (const item of trashedItems) {
      for (const size of ['200', '400', '800']) {
        const thumbPath = path.join(thumbDir, `${item.id}_${size}.webp`);
        if (fs.existsSync(thumbPath)) {
          fs.unlinkSync(thumbPath);
        }
      }
    }

    // Permanently remove from DB
    db.prepare('DELETE FROM media WHERE is_deleted = 1').run();

    res.json({ success: true, deletedCount: trashedItems.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message, code: 'EMPTY_TRASH_FAILED' });
  }
});

// ─── PATCH /api/media/:id/favorite ─── Toggle favorite
router.patch('/:id/favorite', (req, res) => {
  const schema = z.object({ is_favorite: z.boolean() })
  const body = schema.safeParse(req.body)
  if (!body.success) {
    return res.status(400).json({ error: 'Invalid request body' })
  }

  const mediaItem = db.prepare('SELECT id FROM media WHERE id = ? AND is_deleted = 0')
    .get(req.params.id)
  if (!mediaItem) {
    return res.status(404).json({ error: 'Media not found' })
  }

  db.prepare('UPDATE media SET is_favorite = ? WHERE id = ?')
    .run(body.data.is_favorite ? 1 : 0, req.params.id)

  res.json({ success: true, is_favorite: body.data.is_favorite })
})

export default router;

