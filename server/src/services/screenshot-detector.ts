import { db } from '../db';
import fs from 'fs';
import path from 'path';

export interface ScreenshotDetectionResult {
  isScreenshot: boolean;
  reason?: 'filename' | 'exif_software' | 'aspect_ratio';
}

export function detectScreenshot(
  filename: string,
  width: number,
  height: number,
  exifData: any
): ScreenshotDetectionResult {
  let suspicionScore = 0;
  let matches: ScreenshotDetectionResult['reason'][] = [];

  // 1. Check filename
  const lowerName = filename.toLowerCase();
  if (
    lowerName.startsWith('screenshot') ||
    lowerName.includes('screen shot') ||
    lowerName.startsWith('screencap') ||
    lowerName.startsWith('capture')
  ) {
    return { isScreenshot: true, reason: 'filename' };
  }

  // 2. Check EXIF Software tag and common screen resolutions
  const software = exifData?.Software?.toLowerCase() || '';
  const isMobileOS = 
    software.includes('android') || 
    software.includes('ios') || 
    software.includes('miui') || 
    software.includes('emui') || 
    software.includes('oneui') || 
    software.includes('iphone os');

  if (isMobileOS && width > 0 && height > 0) {
    suspicionScore += 2;
    matches.push('exif_software');
  }

  // 3. Check Aspect Ratio (phone portrait)
  if (width > 0 && height > 0) {
    // Standard phone screen is often around 9:16 to 9:22
    // We check portrait orientations first
    const ar = height > width ? height / width : width / height; 
    // Accept standard sizes (16:9 = 1.77, 18:9 = 2.0, 19.5:9 = 2.16, 21:9 = 2.33)
    if (ar >= 1.77 && ar <= 2.4) {
      // If we also don't have GPS data, it increases suspicion
      if (!exifData?.latitude) {
        suspicionScore += 1;
        matches.push('aspect_ratio');
      }
    }
  }

  // If score is high enough or explicit rules matched
  if (suspicionScore >= 2 || matches.includes('exif_software')) {
    return { isScreenshot: true, reason: matches[0] || 'aspect_ratio' };
  }

  return { isScreenshot: false };
}

export function scanAllForScreenshots() {
  const mediaRows = db.prepare(`
    SELECT id, file_name, file_path, width, height, 
           exif_make, exif_model, exif_software, exif_gps_lat 
    FROM media 
    WHERE is_deleted = 0
  `).all() as any[];

  let detectedCount = 0;

  const updateStmt = db.prepare(`
    UPDATE media 
    SET is_screenshot = ?, screenshot_detected_at = ? 
    WHERE id = ?
  `);

  for (const row of mediaRows) {
    const exifMock = {
      Make: row.exif_make,
      Model: row.exif_model,
      Software: row.exif_software,
      latitude: row.exif_gps_lat,
    };

    const result = detectScreenshot(row.file_name, row.width || 0, row.height || 0, exifMock);
    
    // We update all rows to ensure consistency (e.g. if something was falsely flagged previously)
    updateStmt.run(
      result.isScreenshot ? 1 : 0, 
      result.isScreenshot ? new Date().toISOString() : null, 
      row.id
    );

    if (result.isScreenshot) {
      detectedCount++;
    }
  }

  return detectedCount;
}
