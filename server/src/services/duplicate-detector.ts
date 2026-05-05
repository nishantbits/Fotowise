import crypto from 'crypto';
import fs from 'fs';
import { db } from '../db';
import path from 'path';
import { config } from '../config';

export function computeFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}

export async function scanLibraryForDuplicates() {
  // First, ensure all media have hashes
  // Note: we'd normally do this in batches or background worker for massive libraries.
  // We'll compute hashes for any media that missing it.
  
  const unhashed = db.prepare('SELECT id, file_path FROM media WHERE file_hash IS NULL').all() as any[];
  
  for (const item of unhashed) {
    const defaultLibraryRoot = config.libraryPath;
    const fullPath = path.join(defaultLibraryRoot, item.file_path);
    if (!fs.existsSync(fullPath)) continue;
    
    try {
      const h = await computeFileHash(fullPath);
      db.prepare('UPDATE media SET file_hash = ?, file_hash_computed_at = ? WHERE id = ?')
        .run(h, new Date().toISOString(), item.id);
    } catch(e) {
      console.error(`Failed to hash ${fullPath}`, e);
    }
  }

  // Clear existing duplicate groups
  db.prepare('DELETE FROM duplicate_groups').run();
  
  // Find duplicates
  const duplicates = db.prepare(`
    SELECT file_hash, COUNT(*) as count, SUM(file_size) as total_size
    FROM media 
    WHERE file_hash IS NOT NULL AND is_deleted = 0
    GROUP BY file_hash 
    HAVING count > 1
  `).all() as any[];
  
  const insertGroup = db.prepare(`
    INSERT INTO duplicate_groups (id, hash, best_media_id, member_count, total_size_bytes, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  for (const group of duplicates) {
    // get members
    const members = db.prepare(`
      SELECT id, width, height, file_size 
      FROM media 
      WHERE file_hash = ? AND is_deleted = 0
    `).all(group.file_hash) as any[];
    
    if (members.length < 2) continue;
    
    // Determine the best copy: prefer hi-res, then largest file sz
    members.sort((a, b) => {
      const resA = (a.width || 0) * (a.height || 0);
      const resB = (b.width || 0) * (b.height || 0);
      if (resA !== resB) return resB - resA;
      return (b.file_size || 0) - (a.file_size || 0);
    });
    
    const bestId = members[0].id;
    const groupId = `dup-${crypto.randomUUID()}`;
    
    insertGroup.run(groupId, group.file_hash, bestId, group.count, group.total_size, new Date().toISOString());
  }
}
