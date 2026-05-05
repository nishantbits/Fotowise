
import { mediaApi } from '../../lib/api';
import type { MediaItem } from '../../lib/api';
import { Play, Download, Bookmark } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

interface MediaCardProps {
  item: MediaItem;
  onClick?: () => void;
}

export function MediaCard({ item, onClick }: MediaCardProps) {
  const navigate = useNavigate();
  const isVideo = item.mime_type.startsWith('video');
  const thumbUrl = mediaApi.getThumbnailUrl(item.id, '400');
  
  // Parse date safely
  const dateStr = item.created_at;
  const formattedDate = dateStr ? format(new Date(dateStr), 'MMM d, yyyy') : '';

  return (
    <motion.div 
      data-testid={`media-card-${item.id}`}
      role="article"
      aria-label={`Media: ${item.file_name}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ 
        scale: 1.03, 
        y: -5,
        boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.5), 0 8px 10px -6px rgb(0 0 0 / 0.5)"
      }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="group relative cursor-pointer overflow-hidden rounded-xl bg-[var(--bg-elevated)]"
      onClick={() => {
        if (onClick) onClick();
        else navigate(`/media/${item.id}`);
      }}
    >
      {/* Thumbnail */}
      <img
        src={thumbUrl}
        alt={item.file_name}
        className="w-full h-auto block object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        loading="lazy"
      />

      {/* Video Indicator */}
      {isVideo && (
        <div className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md">
          <Play className="h-4 w-4" fill="currentColor" />
        </div>
      )}

      {/* AI Category / Warning Badges */}
      <div className="absolute top-3 left-3 flex flex-col gap-2">
        {item.blur_score < 100 && item.blur_score > 0 && (
          <span className="rounded-md bg-yellow-500/80 px-2 py-1 text-xs font-semibold text-white backdrop-blur-md">
            Blurry
          </span>
        )}
        {item.is_screenshot === 1 && (
          <span className="rounded-md bg-blue-500/80 px-2 py-1 text-xs font-semibold text-white backdrop-blur-md">
            Screenshot
          </span>
        )}
      </div>

      {/* Hover Overlay */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <p className="truncate font-medium text-white shadow-black drop-shadow-md">
          {item.file_name}
        </p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-gray-300 drop-shadow-md">{formattedDate}</span>
          <div className="flex items-center gap-2">
            <button data-testid={`download-${item.id}`} className="text-white hover:text-[var(--accent-green)] transition-colors p-1" title="Download" aria-label={`Download ${item.file_name}`} onClick={(e) => e.stopPropagation()}>
              <Download className="h-4 w-4" />
            </button>
            <button data-testid={`bookmark-${item.id}`} className="text-white hover:text-[var(--accent-green)] transition-colors p-1" title="Bookmark" aria-label={`Bookmark ${item.file_name}`} onClick={(e) => e.stopPropagation()}>
              <Bookmark className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
