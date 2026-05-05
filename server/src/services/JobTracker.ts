import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { db } from '../db';

export type JobType = 'ai_index' | 'rebuild_thumbnails' | 'face_cluster';
export type JobStatus = 'running' | 'completed' | 'failed';

export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  progress: number;
  total: number;
  error?: string;
  created_at: string;
  updated_at: string;
}

// Module-level reference to the WebSocket server, set once on startup.
let _wss: WebSocketServer | null = null;

export function initJobTracker(wss: WebSocketServer) {
  _wss = wss;

  // On startup, mark any jobs that were "running" (from a previous crash) as failed.
  try {
    db.prepare(`
      UPDATE jobs SET status = 'failed', error = 'Server restarted mid-job', updated_at = ?
      WHERE status = 'running'
    `).run(new Date().toISOString());
  } catch {
    // Table may not exist yet on very first startup (before migrations run).
    // That is fine — migrations run right after this.
  }
}

function broadcast(payload: object) {
  if (!_wss) return;
  const msg = JSON.stringify(payload);
  _wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try { client.send(msg); } catch { /* ignore closed mid-send */ }
    }
  });
}

export function createJob(type: JobType, total: number): Job {
  const now = new Date().toISOString();
  const job: Job = {
    id: crypto.randomUUID(),
    type,
    status: 'running',
    progress: 0,
    total,
    created_at: now,
    updated_at: now,
  };

  db.prepare(`
    INSERT INTO jobs (id, type, status, progress, total, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(job.id, job.type, job.status, job.progress, job.total, job.created_at, job.updated_at);

  broadcast({ type: 'job_started', job });
  return job;
}

export function updateJobProgress(jobId: string, progress: number) {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE jobs SET progress = ?, updated_at = ? WHERE id = ?
  `).run(progress, now, jobId);

  broadcast({ type: 'job_progress', jobId, progress });
}

export function completeJob(jobId: string) {
  const now = new Date().toISOString();
  // Set progress = total to guarantee 100%
  const row = db.prepare('SELECT total FROM jobs WHERE id = ?').get(jobId) as { total: number } | undefined;
  const total = row?.total ?? 0;

  db.prepare(`
    UPDATE jobs SET status = 'completed', progress = total, updated_at = ? WHERE id = ?
  `).run(now, jobId);

  broadcast({ type: 'job_completed', jobId, total });
}

export function failJob(jobId: string, error: string) {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE jobs SET status = 'failed', error = ?, updated_at = ? WHERE id = ?
  `).run(error, now, jobId);

  broadcast({ type: 'job_failed', jobId, error });
}

/** Returns active + recently completed jobs (last 24 h) */
export function getRecentJobs(): Job[] {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return db.prepare(`
    SELECT * FROM jobs
    WHERE status = 'running' OR updated_at > ?
    ORDER BY created_at DESC
    LIMIT 20
  `).all(cutoff) as Job[];
}
