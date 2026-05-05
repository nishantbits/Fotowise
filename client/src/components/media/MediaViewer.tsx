import { motion, AnimatePresence } from 'framer-motion';
import type { MediaItem } from '../../lib/api';
import { mediaApi } from '../../lib/api';

interface MediaViewerProps {
  item: MediaItem;
}

export function MediaViewer({ item }: MediaViewerProps) {
  const isVideo = item.mime_type?.startsWith('video/') ?? false;
  const originalUrl = mediaApi.getOriginalUrl(item.id);
  const thumbUrl = mediaApi.getThumbnailUrl(item.id, '400');

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      {/* Blurred Background Filter */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`bg-${item.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 z-0 bg-cover bg-center brightness-50 opacity-30"
          style={{ backgroundImage: `url(${thumbUrl})`, filter: 'blur(100px)' }}
        />
      </AnimatePresence>

      {/* Main Image Container */}
      <div className="relative z-10 flex h-full w-full items-center justify-center p-8 lg:p-16 pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={`img-${item.id}`}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.05, y: -10 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="flex h-full w-full items-center justify-center drop-shadow-2xl"
          >
            {isVideo ? (
              <video
                src={originalUrl}
                controls
                autoPlay
                className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl ring-1 ring-white/10"
              />
            ) : (
              <img
                src={originalUrl}
                alt={item.file_name}
                className="max-h-full max-w-full rounded-md object-contain shadow-2xl ring-1 ring-white/10"
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
