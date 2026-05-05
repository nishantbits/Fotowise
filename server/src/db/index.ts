import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config';

// Ensure data directory exists
const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(config.dbPath, {
  verbose: config.nodeEnv === 'development' ? console.log : undefined,
});
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Simple migration runner
const migrations = [
  `
  CREATE TABLE IF NOT EXISTS media (
    id TEXT PRIMARY KEY,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    width INTEGER,
    height INTEGER,
    duration_ms INTEGER,
    created_at TEXT,
    imported_at TEXT,
    
    blur_score REAL,
    sharpness_score REAL,
    sharpness_analyzed_at TEXT,
    is_screenshot INTEGER DEFAULT 0,
    screenshot_detected_at TEXT,
    is_favorite INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    perceptual_hash TEXT,
    clip_embedding BLOB,
    
    exif_make TEXT,
    exif_model TEXT,
    exif_lens TEXT,
    exif_iso INTEGER,
    exif_aperture REAL,
    exif_shutter TEXT,
    exif_focal_length REAL,
    exif_gps_lat REAL,
    exif_gps_lng REAL,
    exif_gps_altitude REAL,
    exif_color_space TEXT,
    
    custom_title TEXT,
    description TEXT
  );
  `,
  `CREATE INDEX IF NOT EXISTS idx_media_created ON media(created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_media_hash ON media(perceptual_hash);`,
  `CREATE INDEX IF NOT EXISTS idx_media_blur ON media(blur_score);`,
  `CREATE INDEX IF NOT EXISTS idx_media_screenshot ON media(is_screenshot);`,
  
  `
  CREATE TABLE IF NOT EXISTS albums (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    cover_media_id TEXT,
    type TEXT DEFAULT 'manual',
    created_at TEXT,
    metadata TEXT
  );
  `,
  `CREATE INDEX IF NOT EXISTS idx_albums_type ON albums(type);`,
  
  `
  CREATE TABLE IF NOT EXISTS album_media (
    album_id TEXT,
    media_id TEXT,
    position INTEGER,
    PRIMARY KEY (album_id, media_id),
    FOREIGN KEY(album_id) REFERENCES albums(id) ON DELETE CASCADE,
    FOREIGN KEY(media_id) REFERENCES media(id) ON DELETE CASCADE
  );
  `,
  `CREATE INDEX IF NOT EXISTS idx_album_media_pos ON album_media(album_id, position);`,
  
  `
  CREATE TABLE IF NOT EXISTS bookmarks (
    media_id TEXT PRIMARY KEY,
    bookmarked_at TEXT,
    FOREIGN KEY(media_id) REFERENCES media(id) ON DELETE CASCADE
  );
  `,
  
  `
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
  `,
  
  `
  CREATE TABLE IF NOT EXISTS duplicate_groups (
    id TEXT PRIMARY KEY,
    hash TEXT NOT NULL,
    best_media_id TEXT NOT NULL,
    member_count INTEGER NOT NULL,
    total_size_bytes INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (best_media_id) REFERENCES media(id) ON DELETE CASCADE
  );
  `,

  `
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    progress INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  `,
  `CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);`
];

export function runMigrations() {
  console.log('Running migrations...');
  db.exec('BEGIN TRANSACTION');
  try {
    for (const sql of migrations) {
      db.exec(sql);
    }

    // Add columns dynamically for existing DBs
    const tableInfo = db.pragma('table_info(media)') as any[];
    const columns = tableInfo.map(c => c.name);
    if (!columns.includes('screenshot_detected_at')) {
      db.exec('ALTER TABLE media ADD COLUMN screenshot_detected_at TEXT;');
    }
    if (!columns.includes('sharpness_score')) {
      db.exec('ALTER TABLE media ADD COLUMN sharpness_score REAL;');
    }
    if (!columns.includes('sharpness_analyzed_at')) {
      db.exec('ALTER TABLE media ADD COLUMN sharpness_analyzed_at TEXT;');
    }
    if (!columns.includes('file_hash')) {
      db.exec('ALTER TABLE media ADD COLUMN file_hash TEXT;');
      db.exec('CREATE INDEX IF NOT EXISTS idx_media_file_hash ON media(file_hash);');
    }
    if (!columns.includes('file_hash_computed_at')) {
      db.exec('ALTER TABLE media ADD COLUMN file_hash_computed_at TEXT;');
    }
    if (!columns.includes('is_document')) {
      db.exec('ALTER TABLE media ADD COLUMN is_document INTEGER DEFAULT 0;');
    }
    if (!columns.includes('document_type')) {
      db.exec('ALTER TABLE media ADD COLUMN document_type TEXT;');
    }
    if (!columns.includes('document_confidence')) {
      db.exec('ALTER TABLE media ADD COLUMN document_confidence REAL;');
    }
    if (!columns.includes('document_detected_at')) {
      db.exec('ALTER TABLE media ADD COLUMN document_detected_at TEXT;');
    }
    if (!columns.includes('deleted_at')) {
      db.exec('ALTER TABLE media ADD COLUMN deleted_at TEXT;');
    }

    db.exec('COMMIT');
    console.log('Migrations applied successfully.');
  } catch (error) {
    db.exec('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  }
}
