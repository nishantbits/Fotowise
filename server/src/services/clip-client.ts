import axios, { AxiosError } from 'axios';
import { config } from '../config';

const LOG = '[CLIP]';

const client = axios.create({
  baseURL: config.clipServiceUrl,
  timeout: 60000, // 60s — model inference can be slow on CPU
});

// ─── helpers ─────────────────────────────────────────────────────────────────

function axiosErrMsg(err: unknown): string {
  if (err instanceof AxiosError) {
    const detail = err.response?.data?.detail;
    return detail ? `HTTP ${err.response?.status} — ${detail}` : err.message;
  }
  return String(err);
}

// ─── image embedding ──────────────────────────────────────────────────────────

export async function generateImageEmbedding(imagePath: string): Promise<Float32Array | null> {
  console.log(`${LOG} Generating image embedding for: ${imagePath}`);
  try {
    const response = await client.post('/embed', { image_path: imagePath });
    const arr = new Float32Array(response.data.embedding);
    console.log(`${LOG} Image embedding OK — dim=${arr.length} path=${imagePath}`);
    return arr;
  } catch (error) {
    console.error(`${LOG} generateImageEmbedding FAILED for ${imagePath}:`, axiosErrMsg(error));
    return null;
  }
}

// ─── text embedding ───────────────────────────────────────────────────────────

export async function generateTextEmbedding(text: string): Promise<Float32Array | null> {
  console.log(`${LOG} Generating text embedding for query: "${text}"`);
  try {
    const response = await client.post('/embed-text', { text });
    const arr = new Float32Array(response.data.embedding);
    console.log(`${LOG} Text embedding OK — dim=${arr.length}`);
    return arr;
  } catch (error) {
    console.error(`${LOG} generateTextEmbedding FAILED for "${text}":`, axiosErrMsg(error));
    return null;
  }
}

// ─── image classification (auto-tagging) ─────────────────────────────────────

interface TagScore {
  tag: string;
  category: string;
  score: number;
}

/**
 * Classify an image and return matching tags above `threshold`.
 * Default threshold lowered to 0.15 (from 0.22) to generate more useful tags
 * for typical phone photos — the old threshold was too strict.
 */
export async function classifyImage(imagePath: string, threshold = 0.15): Promise<TagScore[]> {
  console.log(`${LOG} Classifying image: ${imagePath} (threshold=${threshold})`);
  try {
    const response = await client.post('/classify', { image_path: imagePath, threshold });
    const tags: TagScore[] = response.data.tags ?? [];
    console.log(`${LOG} Classify OK — ${tags.length} tag(s) for ${imagePath}: ${tags.slice(0, 5).map(t => t.tag).join(', ')}`);
    return tags;
  } catch (error) {
    console.error(`${LOG} classifyImage FAILED for ${imagePath}:`, axiosErrMsg(error));
    return [];
  }
}

// ─── health check ─────────────────────────────────────────────────────────────

export async function isClipServiceHealthy(): Promise<boolean> {
  try {
    const response = await client.get('/health', { timeout: 5000 });
    const healthy = response.status === 200 && response.data.status === 'ok';
    if (!healthy) {
      console.warn(`${LOG} Health check returned unexpected response:`, response.data);
    }
    return healthy;
  } catch (error) {
    console.warn(`${LOG} Health check FAILED — CLIP service may not be reachable:`, axiosErrMsg(error));
    return false;
  }
}

// ─── math helpers ─────────────────────────────────────────────────────────────

export function embeddingToBuffer(embedding: Float32Array): Buffer {
  return Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength);
}

export function bufferToEmbedding(buffer: Buffer): Float32Array {
  return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
