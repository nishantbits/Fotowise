import * as faceapi from 'face-api.js';
import { Canvas, Image, ImageData, createCanvas, loadImage } from 'canvas';
import { db } from '../db';
import crypto from 'crypto';
import path from 'path';

// @ts-ignore
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

import { config } from '../config';

const MODELS_PATH = path.join(config.modelsPath, 'face-api');

let modelsLoaded = false;

async function loadModels() {
  if (modelsLoaded) return;
  try {
    await faceapi.nets.tinyFaceDetector.loadFromDisk(MODELS_PATH);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS_PATH);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(MODELS_PATH);
    modelsLoaded = true;
    console.log('[Face Detector] Models loaded successfully from:', MODELS_PATH);
  } catch (err) {
    console.error('[Face Detector] Failed to load models from:', MODELS_PATH, err);
    throw err;
  }
}

export async function detectFaces(imagePath: string, imageWidth: number, imageHeight: number) {
  try {
    await loadModels();
    const image = await loadImage(imagePath);
    const canvas = createCanvas(imageWidth || image.width, imageHeight || image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image as any, 0, 0, canvas.width, canvas.height);

    const detections = await faceapi.detectAllFaces(
      canvas as any, 
      new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 })
    ).withFaceLandmarks().withFaceDescriptors();

    return detections.map((d: any) => {
      // Return normalized bbox coordinates
      return {
        bbox_x: d.detection.box.x / canvas.width,
        bbox_y: d.detection.box.y / canvas.height,
        bbox_w: d.detection.box.width / canvas.width,
        bbox_h: d.detection.box.height / canvas.height,
        descriptor: new Float32Array(d.descriptor),
        score: d.detection.score
      };
    });
  } catch (error) {
    console.error('Face detection failed:', error);
    return [];
  }
}

function euclideanDistance(a: Float32Array | number[], b: Float32Array | Buffer | number[]): number {
  if (a.length !== b.length) return 999;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.pow(a[i] - b[i], 2);
  }
  return Math.sqrt(sum);
}

function blobToFloat32Array(blob: Buffer): Float32Array {
  return new Float32Array(blob.buffer, blob.byteOffset, blob.byteLength / 4);
}

// Do not change this value, can be tuned by developer
const CLUSTER_THRESHOLD = 0.50; 

export async function processAndClusterFaces(mediaId: string, imagePath: string, width: number, height: number): Promise<void> {
  const faces = await detectFaces(imagePath, width, height);
  if (faces.length === 0) return;

  db.exec('BEGIN TRANSACTION');
  try {
    const existingClusters = db.prepare('SELECT id, cover_media_id, photo_count FROM face_clusters').all() as any[];
    // Get representative embedding for each cluster. For simplicity, we get one detection per cluster.
    const clustersWithEmbeddings = [];
    for (const c of existingClusters) {
      const rep = db.prepare('SELECT embedding FROM face_detections WHERE cluster_id = ? LIMIT 1').get(c.id) as { embedding: Buffer } | undefined;
      if (rep) {
        clustersWithEmbeddings.push({ ...c, descriptor: blobToFloat32Array(rep.embedding) });
      }
    }

    const insertDetection = db.prepare(`
      INSERT INTO face_detections (id, media_id, cluster_id, embedding, bbox_x, bbox_y, bbox_w, bbox_h, confidence, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertCluster = db.prepare(`
      INSERT INTO face_clusters (id, name, cover_media_id, photo_count, created_at, updated_at)
      VALUES (?, NULL, ?, 1, ?, ?)
    `);
    const updateClusterCount = db.prepare('UPDATE face_clusters SET photo_count = photo_count + 1, updated_at = ? WHERE id = ?');
    
    const now = new Date().toISOString();

    for (const face of faces) {
      let bestClusterId = null;
      let minDistance = 999;

      for (const c of clustersWithEmbeddings) {
        const dist = euclideanDistance(face.descriptor, c.descriptor);
        if (dist < minDistance) {
          minDistance = dist;
          bestClusterId = c.id;
        }
      }

      const faceId = crypto.randomUUID();
      const embeddingBuffer = Buffer.from(face.descriptor.buffer);

      if (minDistance < CLUSTER_THRESHOLD && bestClusterId) {
        insertDetection.run(faceId, mediaId, bestClusterId, embeddingBuffer, face.bbox_x, face.bbox_y, face.bbox_w, face.bbox_h, face.score, now);
        updateClusterCount.run(now, bestClusterId);
      } else {
        const newClusterId = crypto.randomUUID();
        insertCluster.run(newClusterId, mediaId, now, now);
        insertDetection.run(faceId, mediaId, newClusterId, embeddingBuffer, face.bbox_x, face.bbox_y, face.bbox_w, face.bbox_h, face.score, now);
        
        // Add to our in-memory list so subsequent faces in this same image can cluster with it
        clustersWithEmbeddings.push({ id: newClusterId, descriptor: face.descriptor });
      }
    }

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    console.error('Error clustering faces:', error);
    throw error;
  }
}
