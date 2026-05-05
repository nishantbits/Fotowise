import { Router } from 'express';
import { db } from '../../db';
import { createDocumentsZip, detectDocument } from '../../services/document-detector';
import { extractTextFromImage } from '../../services/ocr-service';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { config } from '../../config';

const router = Router();

// GET /api/explore/documents
router.get('/', (req, res) => {
  try {
    const querySchema = z.object({
      page:   z.coerce.number().int().min(1).default(1),
      limit:  z.coerce.number().int().min(1).max(100).default(60),
      sort:   z.enum(['date_desc', 'name_asc']).default('date_desc'),
      filter: z.string().default('all'),
      q:      z.string().default(''),
    });
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.flatten() });
    }
    const { page, limit, sort, filter, q } = parsed.data;
    
    let whereClause = 'WHERE is_document = 1 AND is_deleted = 0';
    const params: any[] = [];

    if (filter === 'id_passport') {
      whereClause += ' AND document_type IN ("passport", "id_card")';
    } else if (filter === 'bills') {
      whereClause += ' AND document_type IN ("bill", "invoice", "receipt")';
    } else if (filter === 'forms') {
      whereClause += ' AND document_type IN ("form", "permit", "contract")';
    } else if (filter === 'certificates') {
      whereClause += ' AND document_type IN ("certificate", "letter", "note")';
    }

    if (q) {
      whereClause += ' AND file_name LIKE ?';
      params.push(`%${q}%`);
    }

    let orderClause = 'ORDER BY created_at DESC';
    if (sort === 'name_asc') orderClause = 'ORDER BY file_name ASC';

    const offset = (page - 1) * limit;

    const countRow = db.prepare(`SELECT COUNT(*) as c FROM media ${whereClause}`).get(...params) as any;
    
    // Include OCR fields in the SELECT
    const rows = db.prepare(`
      SELECT id, file_name, file_size, created_at, document_type, document_confidence, 
             ocr_extracted_amount, ocr_extracted_date, ocr_extracted_merchant, ocr_processed_at
      FROM media
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as any[];

    const typeCounts = db.prepare(`
      SELECT document_type, COUNT(*) as c
      FROM media
      WHERE is_document = 1 AND is_deleted = 0
      GROUP BY document_type
    `).all() as { document_type: string, c: number }[];

    const counts = {
      idPassport: 0, bills: 0, forms: 0, certificates: 0
    };

    typeCounts.forEach(row => {
      const type = row.document_type || '';
      const c = row.c;
      if (['passport', 'id_card'].includes(type)) counts.idPassport += c;
      else if (['bill', 'invoice', 'receipt'].includes(type)) counts.bills += c;
      else if (['form', 'permit', 'contract'].includes(type)) counts.forms += c;
      else if (['certificate', 'letter', 'note'].includes(type)) counts.certificates += c;
    });

    res.json({
      items: rows.map(r => ({
        id: r.id,
        filename: r.file_name,
        thumbnailUrl: `/api/media/${r.id}/thumb/400`,
        originalUrl: `/api/media/${r.id}/original`,
        takenAt: r.created_at,
        fileSizeBytes: r.file_size,
        documentType: r.document_type || 'unknown',
        documentConfidence: r.document_confidence || 0,
        ocrAmount: r.ocr_extracted_amount,
        ocrDate: r.ocr_extracted_date,
        ocrMerchant: r.ocr_extracted_merchant,
        ocrProcessedAt: r.ocr_processed_at
      })),
      meta: {
        total: countRow.c,
        page: page,
        totalPages: Math.ceil(countRow.c / limit)
      },
      counts
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/explore/documents/:id/export
router.get('/:id/export', (req, res) => {
  try {
    const { id } = req.params;
    const record = db.prepare('SELECT file_path, file_name FROM media WHERE id = ?').get(id) as any;
    if (!record) return res.status(404).json({ error: 'Not found' });

    const fullPath = path.join(req.app.locals.libraryPath, record.file_path);
    res.download(fullPath, record.file_name);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/explore/documents/export
router.post('/export', async (req, res) => {
  try {
    const { ids } = req.body || {};
    let targetIds = ids || [];
    
    // If no IDs given, export all documents
    if (!ids || ids.length === 0) {
      const rows = db.prepare('SELECT id FROM media WHERE is_document = 1 AND is_deleted = 0').all() as any[];
      targetIds = rows.map(r => r.id);
    }

    if (targetIds.length === 0) {
      return res.status(400).json({ error: 'No documents to export' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="fotowise-documents-${Date.now()}.zip"`);
    await createDocumentsZip(res, targetIds, req.app.locals.libraryPath);
  } catch (error: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

// PATCH /api/explore/documents/:id
router.patch('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { documentType } = req.body;
    
    if (documentType) {
      db.prepare('UPDATE media SET document_type = ? WHERE id = ?').run(documentType, id);
    }
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/explore/documents/:id/ocr
router.post('/:id/ocr', async (req, res) => {
  try {
    const { id } = req.params;
    const record = db.prepare('SELECT file_path FROM media WHERE id = ?').get(id) as { file_path: string } | undefined;
    
    if (!record) return res.status(404).json({ error: 'Not found' });
    
    const fullPath = path.join(req.app.locals.libraryPath, record.file_path);
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'File missing' });

    const result = await extractTextFromImage(fullPath);
    
    db.prepare(`
      UPDATE media 
      SET ocr_text = ?, 
          ocr_extracted_amount = ?, 
          ocr_extracted_date = ?, 
          ocr_extracted_merchant = ?, 
          ocr_processed_at = ?
      WHERE id = ?
    `).run(
      result.fullText, 
      result.extractedAmount, 
      result.extractedDate, 
      result.extractedMerchant, 
      new Date().toISOString(), 
      id
    );

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/explore/documents/analyze
router.post('/analyze', async (req, res) => {
  try {
    res.json({ message: 'started', status: 'running' });

    // Async analysis process
    setImmediate(async () => {
      const libraryRoot = config.libraryPath;
      const updateDoc = db.prepare('UPDATE media SET is_document = ?, document_type = ?, document_confidence = ?, document_detected_at = ? WHERE id = ?');
      
      const batchSize = 50;
      let offset = 0;
      
      while(true) {
        const batch = db.prepare('SELECT id, file_name, file_path, is_screenshot FROM media WHERE is_deleted = 0 AND (document_detected_at IS NULL OR document_type = \'unknown\') AND mime_type LIKE \'image/%\' LIMIT ? OFFSET ?').all(batchSize, offset) as any[];
        if (batch.length === 0) break;

        for (const media of batch) {
          const fullPath = path.join(libraryRoot, media.file_path);
          if (!fs.existsSync(fullPath)) continue;

          const result = await detectDocument(fullPath, media.file_name, media.is_screenshot === 1);
          
          if (result.isDocument) {
            // Also run OCR during rescan for consistency
            const ocr = await extractTextFromImage(fullPath);
            const hasStructuredData = !!(ocr.extractedAmount || ocr.extractedDate || ocr.extractedMerchant);
            
            if (media.is_screenshot === 1 && !hasStructuredData && result.documentType === 'unknown') {
              updateDoc.run(0, null, null, new Date().toISOString(), media.id);
              continue;
            }

            db.prepare('UPDATE media SET is_document = ?, document_type = ?, document_confidence = ?, document_detected_at = ?, ocr_text = ?, ocr_extracted_amount = ?, ocr_extracted_date = ?, ocr_extracted_merchant = ?, ocr_processed_at = ? WHERE id = ?')
              .run(1, result.documentType, result.confidence, new Date().toISOString(), ocr.fullText, ocr.extractedAmount, ocr.extractedDate, ocr.extractedMerchant, new Date().toISOString(), media.id);
          } else {
            updateDoc.run(0, null, null, new Date().toISOString(), media.id);
          }
        }
        
        offset += batchSize;
        await new Promise(r => setTimeout(r, 10)); // Yield to event loop
      }
    });
  } catch (error: any) {
    // If it fails before setImmediate
    console.error(error);
  }
});

export default router;
