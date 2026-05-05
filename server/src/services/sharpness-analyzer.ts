import sharp from 'sharp';
import fs from 'fs';
import { db } from '../db';

export async function calculateSharpness(filePath: string): Promise<number | null> {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`[Sharpness Analyzer] File not found: ${filePath}`);
      return null;
    }

    // Load image and compute stats
    // A simple edge detection approach using Sharp's convolution or stats
    // Sharp provides stats() which includes channel entropy and standard deviation.
    // Higher standard deviation can strongly correlate to contrast.
    // However, for proper Laplacian variance we'd typically use specialized CV libraries.
    // Given we are limited to Sharp, we can use the high-frequency components:

    // We'll downsample to 400px wide to speed up calculations, 
    // convert to greyscale, then measure standard deviation gradient or just rely on stats.stdev.

    // An alternative generic approach using sharp stats:
    // Extract luma channel stats. If stdev is very low (< 20-30), it's highly likely blurry or flat.

    const { channels } = await sharp(filePath)
      .resize(400)
      .greyscale()
      .stats();

    // channels[0] is the greyscale channel
    const stdev = channels[0].stdev;

    // stdev ranges roughly 0 to 127. Let's map it to a 0-100 score.
    // E.g. stdev of 60+ is very sharp. < 20 is very blurry.
    let sharpnessScore = (stdev / 60) * 100;

    if (sharpnessScore > 100) sharpnessScore = 100;
    if (sharpnessScore < 0) sharpnessScore = 0;

    return Number(sharpnessScore.toFixed(2));
  } catch (error) {
    console.error(`[Sharpness Analyzer] Failed to analyze ${filePath}:`, error);
    return null;
  }
}

export async function scanLibraryForSharpness(libraryPath: string) {
  const path = require('path');

  let processed = 0;

  const updateStmt = db.prepare(`
    UPDATE media 
    SET sharpness_score = ?, sharpness_analyzed_at = ? 
    WHERE id = ?
  `);
  
  while(true) {
    const unsetMedia = db.prepare(`
      SELECT id, file_path 
      FROM media 
      WHERE is_deleted = 0 
        AND mime_type LIKE 'image/%' 
        AND (sharpness_analyzed_at IS NULL OR sharpness_score IS NULL)
      LIMIT 50
    `).all() as { id: string, file_path: string }[];
    
    if (unsetMedia.length === 0) break;

    for (const media of unsetMedia) {
      const fullPath = path.join(libraryPath, media.file_path);
      const score = await calculateSharpness(fullPath);

      if (score !== null) {
        updateStmt.run(score, new Date().toISOString(), media.id);
        processed++;
      } else {
        updateStmt.run(null, new Date().toISOString(), media.id);
      }
    }
    
    await new Promise(r => setImmediate(r));
  }

  return processed;
}
