import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { db } from '../db';
import archiver from 'archiver';
import { config } from '../config';

const DOCUMENT_KEYWORDS = [
  { type: 'passport', pattern: /passport/i },
  { type: 'id_card', pattern: /aadhaar|aadhar|pan\b/i },
  { type: 'id_card', pattern: /\blicense\b|\bdl\b/i },
  { type: 'invoice', pattern: /invoice/i },
  { type: 'receipt', pattern: /receipt/i },
  { type: 'bill', pattern: /bill/i },
  { type: 'certificate', pattern: /cert(ificate)?/i },
  { type: 'certificate', pattern: /degree|diploma/i },
  { type: 'contract', pattern: /contract/i },
  { type: 'ticket', pattern: /ticket/i },
  { type: 'letter', pattern: /letter/i },
];

export async function detectDocument(fullPath: string, fileName: string, isScreenshot: boolean = false) {
  try {
    let suspicionScore = 0;
    let documentType = 'unknown';
    let keywordMatched = false;

    // Step 1 - Filename pattern check (+3)
    for (const kw of DOCUMENT_KEYWORDS) {
      if (kw.pattern.test(fileName)) {
        suspicionScore += 3;
        documentType = kw.type;
        keywordMatched = true;
        break;
      }
    }

    const image = sharp(fullPath);
    const metadata = await image.metadata();

    const w = metadata.width || 1;
    const h = metadata.height || 1;
    const ratio = Math.max(w, h) / Math.min(w, h);

    // Step 2 - Aspect ratio check (+2)
    const stdRatios = [
      1.414, // A4
      1.294, // US Letter
      1.586, // ID card
      1.42   // Passport
    ];
    const matchesRatio = stdRatios.some(r => Math.abs(ratio - r) < (r * 0.05));
    if (matchesRatio) suspicionScore += 2;

    // Step 3 - White background check (+2)
    try {
      const stats = await image.clone().resize(50, 50).toColourspace('srgb').stats();
      const avgBrightness = (stats.channels[0].mean + stats.channels[1].mean + stats.channels[2].mean) / 3;
      if (avgBrightness > 180) suspicionScore += 2;
    } catch(e) {}

    // Step 4 - Edge density check (+2)
    try {
      const edgeBuffer = await image.clone()
        .resize(200, 200)
        .greyscale()
        .convolve({ width: 3, height: 3, kernel: [-1,-1,-1, -1,8,-1, -1,-1,-1] })
        .raw()
        .toBuffer();
      
      let edgePixels = 0;
      for (let i = 0; i < edgeBuffer.length; i++) {
        if (edgeBuffer[i] > 30) edgePixels++;
      }
      const edgeDensity = edgePixels / edgeBuffer.length;
      if (edgeDensity > 0.12) suspicionScore += 2;
    } catch(e) {}

    // ── STRICTURE LOGIC FOR SCREENSHOTS ──
    // If it's a screenshot (detected or by filename), we only allow it if it matched a keyword OR has an extremely high score.
    const hasScreenshotInName = /screenshot/i.test(fileName);
    const isLikelyScreenshot = isScreenshot || hasScreenshotInName;

    let isDocument = false;
    if (isLikelyScreenshot) {
      // For screenshots, we require a keyword match AND a decent score, or a very high score (7+)
      isDocument = (keywordMatched && suspicionScore >= 5) || suspicionScore >= 7;
    } else {
      isDocument = suspicionScore >= 3;
    }

    const confidence = isDocument ? Math.min(0.99, (suspicionScore / 9)) : 0;

    return {
      isDocument,
      documentType: isDocument ? documentType : null,
      confidence,
      reason: isDocument ? `Score: ${suspicionScore}${isScreenshot ? ' (Screenshot check passed)' : ''}` : ''
    };
  } catch(e) {
    return { isDocument: false, documentType: null, confidence: 0, reason: 'error' };
  }
}

export async function createDocumentsZip(res: any, mediaIds: string[], libraryPath: string) {
  const archive = archiver('zip', { zlib: { level: 9 } });
  
  res.attachment(`fotowise-documents-${new Date().toISOString().split('T')[0]}.zip`);
  archive.pipe(res);

  let query = 'SELECT file_path, file_name FROM media WHERE is_document = 1';
  let params: any[] = [];
  
  if (mediaIds && mediaIds.length > 0) {
    const placeholders = mediaIds.map(() => '?').join(',');
    query = `SELECT file_path, file_name FROM media WHERE id IN (${placeholders})`;
    params = mediaIds;
  }
  
  const records = db.prepare(query).all(...params) as any[];
  
  for (const record of records) {
    const fullPath = path.join(libraryPath, record.file_path);
    if (fs.existsSync(fullPath)) {
      archive.file(fullPath, { name: record.file_name });
    }
  }

  await archive.finalize();
}

export async function scanLibraryForDocuments() {
  const libraryRoot = config.libraryPath;
  
  const updateDoc = db.prepare('UPDATE media SET is_document = ?, document_type = ?, document_confidence = ?, document_detected_at = ? WHERE id = ?');

  let offset = 0;
  const limit = 50;

  while(true) {
    const batch = db.prepare('SELECT id, file_name, file_path, mime_type FROM media WHERE is_deleted = 0 AND mime_type LIKE \'image/%\' LIMIT ? OFFSET ?').all(limit, offset) as any[];
    if (batch.length === 0) break;

    for (const media of batch) {
      const fullPath = path.join(libraryRoot, media.file_path);
      if (!fs.existsSync(fullPath)) continue;

      const result = await detectDocument(fullPath, media.file_name);
      
      if (result.isDocument) {
        updateDoc.run(1, result.documentType, result.confidence, new Date().toISOString(), media.id);
      } else {
        updateDoc.run(0, null, null, null, media.id);
      }
    }
    
    offset += limit;
    await new Promise(r => setImmediate(r));
  }
}

