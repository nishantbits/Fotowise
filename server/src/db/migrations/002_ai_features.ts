import { db } from '../index';

export function runAiMigrations() {
  console.log('Running 002_ai_features migrations...');
  db.exec('BEGIN TRANSACTION');
  try {
    // Create new tables — all idempotent via IF NOT EXISTS
    db.exec(`
      CREATE TABLE IF NOT EXISTS media_embeddings (
        media_id TEXT PRIMARY KEY,
        embedding BLOB NOT NULL,
        embedding_dim INTEGER NOT NULL DEFAULT 512,
        model_version TEXT NOT NULL DEFAULT 'clip-vit-base-patch32',
        created_at TEXT NOT NULL,
        FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        category TEXT,
        created_at TEXT NOT NULL
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS media_tags (
        media_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 1.0,
        source TEXT NOT NULL DEFAULT 'clip',
        created_at TEXT NOT NULL,
        PRIMARY KEY (media_id, tag_id),
        FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS face_clusters (
        id TEXT PRIMARY KEY,
        name TEXT,
        cover_media_id TEXT,
        photo_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS face_detections (
        id TEXT PRIMARY KEY,
        media_id TEXT NOT NULL,
        cluster_id TEXT,
        embedding BLOB NOT NULL,
        bbox_x REAL NOT NULL,
        bbox_y REAL NOT NULL,
        bbox_w REAL NOT NULL,
        bbox_h REAL NOT NULL,
        confidence REAL NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE,
        FOREIGN KEY (cluster_id) REFERENCES face_clusters(id)
      );
    `);

    // Indexes — all idempotent
    db.exec('CREATE INDEX IF NOT EXISTS idx_face_detections_media_id ON face_detections(media_id);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_face_detections_cluster_id ON face_detections(cluster_id);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_media_embeddings_created ON media_embeddings(created_at);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_media_tags_tag_id ON media_tags(tag_id);');

    // Add columns dynamically using PRAGMA table_info — compatible with all SQLite versions
    // (ALTER TABLE ... ADD COLUMN IF NOT EXISTS requires SQLite 3.37+, not guaranteed in docker)
    const tableInfo = db.pragma('table_info(media)') as { name: string }[];
    const columns = new Set(tableInfo.map((c) => c.name));

    const addColumn = (col: string, definition: string) => {
      if (!columns.has(col)) {
        db.exec(`ALTER TABLE media ADD COLUMN ${col} ${definition};`);
      }
    };

    addColumn('is_document',            'INTEGER DEFAULT 0');
    addColumn('document_type',          'TEXT');
    addColumn('document_confidence',    'REAL');
    addColumn('document_detected_at',   'TEXT');
    addColumn('ocr_text',               'TEXT');
    addColumn('ocr_extracted_amount',   'TEXT');
    addColumn('ocr_extracted_date',     'TEXT');
    addColumn('ocr_extracted_merchant', 'TEXT');
    addColumn('ocr_processed_at',       'TEXT');

    // Index on is_document
    db.exec('CREATE INDEX IF NOT EXISTS idx_media_is_document ON media(is_document);');

    db.exec('COMMIT');
    console.log('002_ai_features migrations applied successfully.');
  } catch (error) {
    db.exec('ROLLBACK');
    console.error('Migration 002 failed:', error);
    throw error;
  }
}
