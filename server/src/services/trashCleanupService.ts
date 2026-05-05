import { db } from '../db'
import { config } from '../config'
import fs from 'fs'
import path from 'path'

const TRASH_RETENTION_DAYS = 30

export function scheduleTrashCleanup(): void {
  // Run once on startup
  runTrashCleanup()

  // Then run daily at 3am (every 24 hours in practice for a server app)
  setInterval(runTrashCleanup, 24 * 60 * 60 * 1000)
}

function runTrashCleanup(): void {
  try {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - TRASH_RETENTION_DAYS)
    const cutoffISO = cutoff.toISOString()

    // Find items that have been in trash for more than 30 days
    // They need a 'deleted_at' timestamp — check if media table has this column
    // If not, use imported_at as a proxy (items deleted before cutoff)
    const staleItems = db.prepare(`
      SELECT id, file_path FROM media
      WHERE is_deleted = 1
      AND (deleted_at < ? OR (deleted_at IS NULL AND imported_at < ?))
    `).all(cutoffISO, cutoffISO) as Array<{ id: string; file_path: string }>

    if (staleItems.length === 0) return

    console.log(`[TrashCleanup] Permanently deleting ${staleItems.length} items older than ${TRASH_RETENTION_DAYS} days`)

    for (const item of staleItems) {
      try {
        // Delete the file from the trash directory (where softDeleteMedia moved it)
        // The file is stored as {id}{extension} in the trash folder
        const trashDir = config.trashPath
        if (fs.existsSync(trashDir)) {
          const trashFiles = fs.readdirSync(trashDir)
          for (const trashFile of trashFiles) {
            if (trashFile.startsWith(item.id)) {
              const trashFilePath = path.join(trashDir, trashFile)
              if (fs.existsSync(trashFilePath)) fs.unlinkSync(trashFilePath)
              break
            }
          }
        }

        // Delete all three thumbnail sizes (200, 400, 800)
        for (const size of ['200', '400', '800']) {
          const thumbPath = path.join(config.thumbnailsPath, `${item.id}_${size}.webp`)
          if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath)
        }

        // Delete from database (cascades to tags, face_detections, etc.)
        db.prepare('DELETE FROM media WHERE id = ?').run(item.id)

        console.log(`[TrashCleanup] Deleted: ${item.id}`)
      } catch (err) {
        console.error(`[TrashCleanup] Failed to delete ${item.id}:`, err)
      }
    }

    console.log(`[TrashCleanup] Complete. ${staleItems.length} items permanently removed.`)
  } catch (err) {
    console.error('[TrashCleanup] Cleanup failed:', err)
  }
}
