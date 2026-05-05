import sharp from 'sharp';
import exifr from 'exifr';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { db } from '../db';
import { detectScreenshot } from './screenshot-detector';
import { calculateSharpness } from './sharpness-analyzer';
import { computeFileHash } from './duplicate-detector';
import { detectDocument } from './document-detector';
import { extractTextFromImage } from './ocr-service';
import { isClipServiceHealthy } from './clip-client';
import { processMediaEmbedding } from './embedding-service';
import { processAndClusterFaces } from './face-detector';
import ffmpeg from 'fluent-ffmpeg';
import { config } from '../config';

async function generateVideoThumbnail(
  videoPath: string,
  mediaId: string
): Promise<string> {
  const thumbnailPath = path.join(config.thumbnailsPath, `${mediaId}.webp`)

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .on('error', (err) => {
        console.error(`[Video Thumbnail] Failed for ${mediaId}:`, err.message)
        reject(err)
      })
      .on('end', async () => {
        // Convert the PNG screenshot to WebP using Sharp for consistency
        const tempPng = path.join(config.thumbnailsPath, `${mediaId}.png`)
        try {
          await sharp(tempPng)
            .webp({ quality: 80 })
            .toFile(thumbnailPath)
          fs.unlinkSync(tempPng)         // clean up temp PNG
          resolve(thumbnailPath)
        } catch (sharpErr) {
          // If WebP conversion fails, use the PNG as-is
          console.error(`[Video Thumbnail] WebP conversion failed:`, sharpErr)
          resolve(tempPng)
        }
      })
      .screenshots({
        timestamps: ['00:00:01'],        // grab frame at 1 second
        filename: `${mediaId}.png`,      // temp file — we convert to webp after
        folder: config.thumbnailsPath,
        size: '400x?',                   // 400px wide, maintain aspect ratio
      })
  })
}

function getVideoDuration(videoPath: string): Promise<number> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(videoPath, (err: any, metadata: any) => {
      if (err || !metadata?.format?.duration) {
        resolve(0)
      } else {
        resolve(Math.floor(metadata.format.duration * 1000)) // milliseconds
      }
    })
  })
}
export async function processMediaFile(file: Express.Multer.File, libraryRoot: string) {
  const isVideo = file.mimetype.startsWith('video/');
  const id = crypto.randomUUID();
  const now = new Date();
  
  // Create /YYYY/MM directory structure
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const relDestDir = path.join('originals', year, month);
  const absDestDir = path.join(libraryRoot, relDestDir);
  
  if (!fs.existsSync(absDestDir)) {
    fs.mkdirSync(absDestDir, { recursive: true });
  }

  // File paths
  const extension = path.extname(file.originalname).toLowerCase();
  const finalFileName = `${id}${extension}`;
  const finalRelPath = path.join(relDestDir, finalFileName);
  const finalAbsPath = path.join(libraryRoot, finalRelPath);

  // Move file from tmp
  try {
    fs.copyFileSync(file.path, finalAbsPath);
  } catch (error) {
    console.error('Failed to persist uploaded file to library:', error);
    throw new Error('Failed to save uploaded file');
  }

  // Best-effort cleanup of temp file
  try {
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  } catch (error) {
    console.warn('Failed to clean up temporary upload file:', error);
  }

  let width = 0, height = 0, blurScore = 0, durationMs = 0;
  let exifData: any = {};
  
  const thumbsDir = path.join(libraryRoot, 'thumbnails');
  if (!fs.existsSync(thumbsDir)) {
    fs.mkdirSync(thumbsDir, { recursive: true });
  }

  if (!isVideo) {
    try {
      const image = sharp(finalAbsPath);
      const metadata = await image.metadata();
      width = metadata.width || 0;
      height = metadata.height || 0;

      // Generate thumbnails
      const sizes = [200, 400, 800];
      for (const size of sizes) {
        await image
          .clone()
          .resize(size, size, { fit: 'inside' })
          .webp({ quality: 80 })
          .toFile(path.join(thumbsDir, `${id}_${size}.webp`));
      }

      // Extract EXIF
      try {
        exifData = (await exifr.parse(finalAbsPath)) || {};
      } catch (e) {
        console.error('EXIF extraction failed', e);
      }

      // Blur detection (Laplacian variance approximation)
      try {
        const greyscale = await image.clone().greyscale().raw().toBuffer();
        // Extremely simplified standard deviation as a proxy for blur score if Laplacian isn't readily available
        // In a production app, we would use a proper Laplacian kernel convolution
        let mean = 0;
        for (let i = 0; i < greyscale.length; i++) mean += greyscale[i];
        mean /= greyscale.length;
        let variance = 0;
        for (let i = 0; i < greyscale.length; i++) variance += Math.pow(greyscale[i] - mean, 2);
        blurScore = variance / greyscale.length;
      } catch (e) {
        console.error('Blur detection failed', e);
      }
    } catch (error) {
      console.error('Image processing failed, falling back to basic metadata:', error);
      width = 0;
      height = 0;
      blurScore = 0;
    }
  } else {
    try {
      await generateVideoThumbnail(finalAbsPath, id);
      durationMs = await getVideoDuration(finalAbsPath);
    } catch (e) {
      console.error('Failed to generate video thumbnail:', e);
    }
    width = 1920; height = 1080; // Placeholder
  }

  const createdAt = exifData.DateTimeOriginal ? new Date(exifData.DateTimeOriginal).toISOString() : now.toISOString();
  
  const screenshotCheck = detectScreenshot(file.originalname, width, height, exifData);
  const isScreenshot = screenshotCheck.isScreenshot ? 1 : 0;
  const screenshotDetectedAt = screenshotCheck.isScreenshot ? now.toISOString() : null;

  // Sharpness logic
  const sharpnessScore = !isVideo ? await calculateSharpness(finalAbsPath) : null;
  const sharpnessAnalyzedAt = sharpnessScore !== null ? now.toISOString() : null;

  // File Hash
  let fileHash = null;
  let fileHashComputedAt = null;
  try {
    fileHash = await computeFileHash(finalAbsPath);
    fileHashComputedAt = now.toISOString();
  } catch (error) {
    console.error('Failed to compute file hash:', error);
  }

  // Insert into DB (document fields start empty, populated asynchronously)
  const stmt = db.prepare(`
    INSERT INTO media (
      id, file_name, file_path, file_size, mime_type, width, height, duration_ms,
      created_at, imported_at, blur_score, sharpness_score, sharpness_analyzed_at, is_screenshot, screenshot_detected_at, perceptual_hash, file_hash, file_hash_computed_at,
      is_document, document_type, document_confidence, document_detected_at,
      exif_make, exif_model, exif_lens, exif_iso, exif_aperture, exif_shutter, exif_focal_length,
      exif_gps_lat, exif_gps_lng
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);

  stmt.run(
    id, file.originalname, finalRelPath, file.size, file.mimetype, width, height, durationMs,
    createdAt, now.toISOString(), blurScore, sharpnessScore, sharpnessAnalyzedAt, isScreenshot, screenshotDetectedAt, 'placeholder-hash', fileHash, fileHashComputedAt,
    0, null, 0, null,
    exifData.Make || null, exifData.Model || null, exifData.LensModel || null,
    exifData.ISO || null, exifData.FNumber || null, exifData.ExposureTime ? String(exifData.ExposureTime) : null,
    exifData.FocalLength || null, exifData.latitude || null, exifData.longitude || null
  );

  // Non-blocking AI pipeline
  if (!isVideo) {
    // Document detection (fast, run immediately)
    detectDocument(finalAbsPath, file.originalname, isScreenshot === 1).then(async (result) => {
      if (result && result.isDocument) {
        const ocr = await extractTextFromImage(finalAbsPath);
        const hasStructuredData = !!(ocr.extractedAmount || ocr.extractedDate || ocr.extractedMerchant);
        const hasScreenshotInName = /screenshot/i.test(file.originalname);
        const isLikelyScreenshot = isScreenshot === 1 || hasScreenshotInName;

        if (isLikelyScreenshot && !hasStructuredData && result.documentType === 'unknown') {
           return;
        }

        db.prepare('UPDATE media SET is_document=?, document_type=?, document_confidence=?, document_detected_at=?, ocr_text=?, ocr_extracted_amount=?, ocr_extracted_date=?, ocr_extracted_merchant=?, ocr_processed_at=? WHERE id=?')
          .run(
            1,
            result.documentType || 'unknown',
            result.confidence || 0,
            new Date().toISOString(),
            ocr.fullText,
            ocr.extractedAmount,
            ocr.extractedDate,
            ocr.extractedMerchant,
            new Date().toISOString(),
            id
          );
      }
    }).catch(console.error);

    // CLIP embedding + auto-tagging (slow, truly async)
    isClipServiceHealthy().then(healthy => {
      if (healthy) {
        processMediaEmbedding(id, finalAbsPath).catch(err => {
          console.error(`[Media Service] processMediaEmbedding FAILED for ${id}:`, err);
        });
      } else {
        console.warn(`[Media Service] Skipping embedding for ${id} — CLIP service is not healthy.`);
      }
    }).catch(err => {
      console.error(`[Media Service] CLIP health check threw for ${id}:`, err);
    });

    // Face detection (slow, truly async)
    processAndClusterFaces(id, finalAbsPath, width, height).catch(console.error);
  }

  return { id, file_name: file.originalname, url: `/api/media/${id}/thumb/400`, is_screenshot: isScreenshot, blur_score: blurScore };
}

export async function replaceMediaFile(id: string, file: Express.Multer.File, libraryRoot: string) {
  // Find existing record
  const record = db.prepare('SELECT file_path, file_name FROM media WHERE id = ? AND is_deleted = 0').get(id) as { file_path: string; file_name: string } | undefined;
  if (!record) throw new Error('Media not found');

  const finalAbsPath = path.join(libraryRoot, record.file_path);
  
  // Ensure the directory still exists
  const dir = path.dirname(finalAbsPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Overwrite file
  try {
    fs.copyFileSync(file.path, finalAbsPath);
  } catch (error) {
    console.error('Failed to overwrite existing media file:', error);
    throw new Error('Failed to replace media file');
  }

  // Best-effort cleanup of temp file
  try {
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  } catch (error) {
    console.warn('Failed to clean up temporary upload file after replace:', error);
  }

  const isVideo = file.mimetype.startsWith('video/');
  let width = 0, height = 0, blurScore = 0;

  const thumbsDir = path.join(libraryRoot, 'thumbnails');
  if (!fs.existsSync(thumbsDir)) fs.mkdirSync(thumbsDir, { recursive: true });

  if (!isVideo) {
    const image = sharp(finalAbsPath);
    const metadata = await image.metadata();
    width = metadata.width || 0;
    height = metadata.height || 0;

    // Regenerate thumbnails
    const sizes = [200, 400, 800];
    for (const size of sizes) {
      await image.clone().resize(size, size, { fit: 'inside' }).webp({ quality: 80 }).toFile(path.join(thumbsDir, `${id}_${size}.webp`));
    }

    // Refresh Blur detection
    try {
      const greyscale = await image.clone().greyscale().raw().toBuffer();
      let mean = 0;
      for (let i = 0; i < greyscale.length; i++) mean += greyscale[i];
      mean /= greyscale.length;
      let variance = 0;
      for (let i = 0; i < greyscale.length; i++) variance += Math.pow(greyscale[i] - mean, 2);
      blurScore = variance / greyscale.length;
    } catch (e) {
      console.error('Blur detection failed', e);
    }
  }

  // Update record
  const stmt = db.prepare(`
    UPDATE media 
    SET file_size = ?, width = ?, height = ?, blur_score = ?
    WHERE id = ?
  `);
  stmt.run(file.size, width, height, blurScore, id);

  return { id, file_name: record.file_name, url: `/api/media/${id}/thumb/400`, blur_score: blurScore };
}

export async function regenerateThumbnailsForExistingMedia(id: string, libraryRoot: string): Promise<boolean> {
  const record = db
    .prepare('SELECT file_path, mime_type FROM media WHERE id = ? AND is_deleted = 0')
    .get(id) as { file_path: string; mime_type: string } | undefined;

  if (!record) {
    return false;
  }

  if (!record.mime_type.startsWith('image/')) {
    // Only generate thumbnails for images
    return false;
  }

  const finalAbsPath = path.join(libraryRoot, record.file_path);
  if (!fs.existsSync(finalAbsPath)) {
    console.warn('Original file missing while rebuilding thumbnails for id:', id);
    return false;
  }

  const thumbsDir = path.join(libraryRoot, 'thumbnails');
  if (!fs.existsSync(thumbsDir)) {
    fs.mkdirSync(thumbsDir, { recursive: true });
  }

  try {
    const image = sharp(finalAbsPath);
    const metadata = await image.metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;

    const sizes = [200, 400, 800];
    for (const size of sizes) {
      await image
        .clone()
        .resize(size, size, { fit: 'inside' })
        .webp({ quality: 80 })
        .toFile(path.join(thumbsDir, `${id}_${size}.webp`));
    }

    // Optionally refresh blur score for better quality metrics
    let blurScore = 0;
    try {
      const greyscale = await image.clone().greyscale().raw().toBuffer();
      let mean = 0;
      for (let i = 0; i < greyscale.length; i++) mean += greyscale[i];
      mean /= greyscale.length;
      let variance = 0;
      for (let i = 0; i < greyscale.length; i++) variance += Math.pow(greyscale[i] - mean, 2);
      blurScore = variance / greyscale.length;
    } catch (e) {
      console.error('Blur detection failed during thumbnail rebuild', e);
    }

    const stmt = db.prepare(`
      UPDATE media
      SET width = ?, height = ?, blur_score = ?
      WHERE id = ?
    `);
    stmt.run(width, height, blurScore, id);

    return true;
  } catch (error) {
    console.error('Failed to regenerate thumbnails for media id:', id, error);
    return false;
  }
}

export function softDeleteMedia(id: string, libraryRoot: string) {
  const record = db.prepare('SELECT file_path, file_name FROM media WHERE id = ? AND is_deleted = 0').get(id) as { file_path: string; file_name: string } | undefined;
  if (!record) throw new Error('Media not found');

  const trashDir = path.join(libraryRoot, 'trash');
  if (!fs.existsSync(trashDir)) fs.mkdirSync(trashDir, { recursive: true });

  const finalAbsPath = path.join(libraryRoot, record.file_path);
  const trashPath = path.join(trashDir, `${id}${path.extname(record.file_name)}`);

  if (fs.existsSync(finalAbsPath)) {
    fs.renameSync(finalAbsPath, trashPath);
  }

  db.prepare('UPDATE media SET is_deleted = 1, deleted_at = ? WHERE id = ?').run(new Date().toISOString(), id);
}

