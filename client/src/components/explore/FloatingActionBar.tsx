import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { X, Trash2, Download, FolderPlus } from 'lucide-react';
import { Button } from '../ui/Button';

interface FloatingActionBarProps {
  count: number;
  onDeselect: () => void;
  onExport?: () => void;
  onAddToAlbum?: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
}

export function FloatingActionBar({
  count,
  onDeselect,
  onExport,
  onAddToAlbum,
  onDelete,
  isDeleting = false,
}: FloatingActionBarProps) {
  if (typeof document === 'undefined') return null; // Safety for SSR if any

  return createPortal(
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-4 rounded-full border border-white/10 bg-[#1a1d1c]/90 px-6 py-3 shadow-2xl backdrop-blur-md z-50 text-[var(--t1)]"
        >
          <div className="flex items-center gap-3 pr-4 border-r border-white/10">
            <button
              onClick={onDeselect}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            >
              <X size={16} />
            </button>
            <span className="font-medium text-sm">
              {count} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onExport && (
              <Button variant="ghost" size="sm" onClick={onExport} className="gap-2">
                <Download size={16} />
                Export
              </Button>
            )}
            
            {onAddToAlbum && (
              <Button variant="ghost" size="sm" onClick={onAddToAlbum} className="gap-2">
                <FolderPlus size={16} />
                Add to Album
              </Button>
            )}

            <Button
              variant="danger"
              size="sm"
              onClick={onDelete}
              disabled={isDeleting}
              isLoading={isDeleting}
              className="gap-2 ml-2"
            >
              <Trash2 size={16} />
              Delete
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
