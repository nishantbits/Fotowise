import { db } from '../db';
import { generateImageEmbedding, classifyImage, embeddingToBuffer } from './clip-client';
import crypto from 'crypto';

const LOG = '[Embedding]';

async function processAutoTags(mediaId: string, originalPath: string): Promise<void> {
  const tags = await classifyImage(originalPath);

  if (tags.length === 0) {
    console.warn(`${LOG} No tags returned for ${mediaId} — image may be ambiguous or path unreachable.`);
    return;
  }


  db.exec('BEGIN TRANSACTION');
  try {
    // Delete existing CLIP tags
    db.prepare('DELETE FROM media_tags WHERE media_id = ? AND source = ?').run(mediaId, 'clip');

    const insertTag = db.prepare('INSERT OR IGNORE INTO tags (id, name, category, created_at) VALUES (?, ?, ?, ?)');
    const selectTag = db.prepare('SELECT id FROM tags WHERE name = ?');
    const insertMediaTag = db.prepare('INSERT OR REPLACE INTO media_tags (media_id, tag_id, confidence, source, created_at) VALUES (?, ?, ?, ?, ?)');

    const now = new Date().toISOString();

    for (const item of tags) {
      let tagRecord = selectTag.get(item.tag) as { id: string } | undefined;

      if (!tagRecord) {
        const newId = crypto.randomUUID();
        insertTag.run(newId, item.tag, item.category, now);
        tagRecord = { id: newId };
      }

      insertMediaTag.run(mediaId, tagRecord.id, item.score, 'clip', now);
    }

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    console.error(`${LOG} Auto-tagging DB write FAILED for ${mediaId}:`, error);
    throw error;
  }
}

export async function processMediaEmbedding(mediaId: string, originalPath: string): Promise<void> {

  const embeddingArray = await generateImageEmbedding(originalPath);
  if (!embeddingArray) {
    console.error(`${LOG} Embedding generation returned null for ${mediaId} — skipping.`);
    return;
  }

  const buffer = embeddingToBuffer(embeddingArray);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR REPLACE INTO media_embeddings (media_id, embedding, embedding_dim, model_version, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(mediaId, buffer, embeddingArray.length, 'clip-vit-base-patch32', now);


  await processAutoTags(mediaId, originalPath);

  if (process.env.NODE_ENV === 'development') {
    console.log(`${LOG} ✅ Pipeline complete for media ${mediaId}`);
  }
}
