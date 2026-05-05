import fs from 'fs';
import path from 'path';
import https from 'https';

import { config } from '../config';

const MODELS_DIR = path.join(config.modelsPath, 'face-api');
const BASE_URL = 'https://github.com/vladmandic/face-api/raw/main/model/';

const FILES = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2'
];

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      } else if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        downloadFile(response.headers.location as string, dest).then(resolve).catch(reject);
      } else {
        file.close();
        fs.unlink(dest, () => {});
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
      }
    }).on('error', (err) => {
      file.close();
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

export async function ensureModelsDownloaded() {
  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
  }

  const downloads: Promise<void>[] = [];

  for (const file of FILES) {
    const dest = path.join(MODELS_DIR, file);
    if (!fs.existsSync(dest)) {
      console.log(`Downloading face-api model: ${file}...`);
      downloads.push(
        downloadFile(BASE_URL + file, dest).catch((err) => {
          console.warn(`[Warning] Could not download ${file}: ${err.message}`);
          console.warn('Face detection features may be unavailable until models are downloaded.');
        })
      );
    }
  }

  if (downloads.length > 0) {
    await Promise.all(downloads);
    console.log('Face-api model download step completed.');
  } else {
    console.log('Face-api models already cached.');
  }
}

// Allow running standalone
if (require.main === module) {
  ensureModelsDownloaded().catch(console.error);
}
