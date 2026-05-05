import { Router } from 'express';
import { db } from '../db';
import { isClipServiceHealthy, generateTextEmbedding, cosineSimilarity, bufferToEmbedding } from '../services/clip-client';
import { processMediaEmbedding } from '../services/embedding-service';
import { createJob, updateJobProgress, completeJob, failJob } from '../services/JobTracker';
import path from 'path';
import { config } from '../config';
import { z } from 'zod';

const router = Router();
const SEARCH_LOG = '[Search]';

router.get('/', async (req, res) => {
  try {
    const querySchema = z.object({
      q:         z.string().max(500).default(''),
      limit:     z.coerce.number().int().min(1).max(100).default(60),
      threshold: z.coerce.number().min(0).max(1).default(0.18), // lowered from 0.20
    });
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.flatten() });
    }
    const { limit, threshold } = parsed.data;
    const q = parsed.data.q.trim();
    // Only log high-level query received
    if (process.env.NODE_ENV === 'development') {
      console.log(`${SEARCH_LOG} Query received: "${q}"`);
    }

    if (!q) {
      return res.status(400).json({ error: 'Invalid query string' });
    }

    // Exact Face Name search first
    const searchTerm = `%${q}%`;
    const faceNameResults = db.prepare(`
      SELECT DISTINCT
        m.id, m.file_name, m.file_path, m.file_size, m.mime_type,
        m.width, m.height, m.created_at, m.imported_at,
        m.blur_score, m.is_screenshot, m.is_deleted, m.is_favorite,
        m.exif_make, m.exif_model, 1.0 as score
      FROM face_clusters fc
      JOIN face_detections fd ON fc.id = fd.cluster_id
      JOIN media m ON fd.media_id = m.id
      WHERE m.is_deleted = 0 AND fc.name LIKE ?
      LIMIT ?
    `).all(searchTerm, limit) as any[];

    // Keyword search
    const keywordResults = db.prepare(`
      SELECT DISTINCT
        m.id, m.file_name, m.file_path, m.file_size, m.mime_type,
        m.width, m.height, m.created_at, m.imported_at,
        m.blur_score, m.is_screenshot, m.is_deleted, m.is_favorite,
        m.exif_make, m.exif_model
      FROM media m
      LEFT JOIN media_tags mt ON m.id = mt.media_id
      LEFT JOIN tags t ON mt.tag_id = t.id
      WHERE m.is_deleted = 0 AND (m.file_name LIKE ? OR t.name LIKE ?)
      LIMIT ?
    `).all(searchTerm, searchTerm, limit) as any[];

    // Structure early results
    let finalResults = [...faceNameResults];
    
    // Add keyword results not in faceNameResults
    const faceIds = new Set(faceNameResults.map(m => m.id));
    for (const kw of keywordResults) {
      if (!faceIds.has(kw.id)) {
        finalResults.push(kw);
      }
    }

    let searchType = 'keyword';
    let semanticCount = 0;
    let keywordCount = finalResults.length;

    // If CLIP is healthy, attempt semantic search
    const healthy = await isClipServiceHealthy();
    if (healthy) {
      const textEmbedding = await generateTextEmbedding(q);
      const status = textEmbedding ? 'OK (dim=' + textEmbedding.length + ')' : 'FAILED — null returned';
      
      if (textEmbedding) {
        searchType = 'semantic+keyword';
        // "For libraries >5,000 photos, replace this in-memory scan with sqlite-vss extension for O(log n) vector search"
        
        const allEmbeddings = db.prepare(`
          SELECT
            e.media_id, e.embedding,
            m.file_name, m.file_path, m.file_size, m.mime_type,
            m.width, m.height, m.created_at, m.imported_at,
            m.blur_score, m.is_screenshot, m.is_deleted, m.is_favorite,
            m.exif_make, m.exif_model
          FROM media_embeddings e
          JOIN media m ON e.media_id = m.id
          WHERE m.is_deleted = 0
        `).all() as any[];

        const semanticMatches = [];
        for (const row of allEmbeddings) {
          const embArray = bufferToEmbedding(row.embedding);
          const score = cosineSimilarity(textEmbedding, embArray);
          if (score >= threshold) {
            semanticMatches.push({
              id: row.media_id,
              file_name: row.file_name,
              file_path: row.file_path,
              file_size: row.file_size,
              mime_type: row.mime_type,
              width: row.width,
              height: row.height,
              created_at: row.created_at,
              imported_at: row.imported_at,
              blur_score: row.blur_score,
              is_screenshot: row.is_screenshot,
              is_deleted: row.is_deleted,
              is_favorite: row.is_favorite,
              exif_make: row.exif_make,
              exif_model: row.exif_model,
              score
            });
          }
        }

        // Sort desc text semantic scores
        semanticMatches.sort((a, b) => b.score - a.score);
        const bestSemantic = semanticMatches.slice(0, limit);
        semanticCount = bestSemantic.length;

        // Merge: Face matches FIRST, then Semantic, then Keyword
        const seenIds = new Set(faceNameResults.map(m => m.id));
        const filteredSemantic = bestSemantic.filter(s => !seenIds.has(s.id));
        
        for (const s of filteredSemantic) seenIds.add(s.id);
        const filteredKeyword = keywordResults.filter(k => !seenIds.has(k.id));
        
        finalResults = [...faceNameResults, ...filteredSemantic, ...filteredKeyword].slice(0, limit);
      }
    }

    // Normalize all results to consistent MediaItem-compatible shape
    const items = finalResults.map(r => ({
      id: r.id,
      file_name: r.file_name ?? r.filename ?? '',
      file_path: r.file_path ?? '',
      file_size: r.file_size ?? r.fileSizeBytes ?? 0,
      mime_type: r.mime_type ?? 'image/jpeg',
      width: r.width ?? 0,
      height: r.height ?? 0,
      created_at: r.created_at ?? r.takenAt ?? '',
      imported_at: r.imported_at ?? '',
      blur_score: r.blur_score ?? 0,
      is_screenshot: r.is_screenshot ?? 0,
      is_deleted: r.is_deleted ?? 0,
      is_favorite: r.is_favorite ?? 0,
      exif_make: r.exif_make ?? null,
      exif_model: r.exif_model ?? null,
      semanticScore: r.score ?? null,
    }));

    res.json({
      items,
      meta: { searchType, semanticCount, keywordCount }
    });

  } catch (error: any) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message, code: 'SEARCH_FAILED' });
  }
});

router.post('/index', async (req, res) => {
  try {
    // Find all media missing embeddings before starting job (so we know total)
    const libraryRoot = config.libraryPath;
    const missing = db.prepare(`
      SELECT id, file_path 
      FROM media 
      WHERE is_deleted = 0 
        AND mime_type LIKE 'image/%'
        AND id NOT IN (SELECT media_id FROM media_embeddings)
    `).all() as { id: string, file_path: string }[];

    const total = missing.length;

    if (total === 0) {
      return res.json({ message: 'Nothing to index — all media already has embeddings.', jobId: null });
    }

    const job = createJob('ai_index', total);

    // Respond immediately so the client gets the jobId before processing starts
    res.json({ message: 'Indexing started', jobId: job.id, total });

    setImmediate(async () => {
      let processed = 0;
      try {
        for (let i = 0; i < missing.length; i += 10) {
          const batch = missing.slice(i, i + 10);
          await Promise.all(batch.map(media => {
            const fullPath = path.join(libraryRoot, media.file_path);
            return processMediaEmbedding(media.id, fullPath).catch(err => {
              console.error(`Embedding failed for ${media.id}:`, err);
            });
          }));

          processed += batch.length;
          // Broadcast progress — capped at total to avoid overshooting
          updateJobProgress(job.id, Math.min(processed, total));
          if (processed % 50 === 0 || processed === total) {
            console.log(`[Search] Indexed ${processed}/${total}`);
          }
        }
        completeJob(job.id);
      } catch (err: any) {
        console.error('[Search] Indexing job failed:', err);
        failJob(job.id, err?.message || 'Unknown error');
      }
    });
  } catch (error: any) {
    console.error('Index start error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
