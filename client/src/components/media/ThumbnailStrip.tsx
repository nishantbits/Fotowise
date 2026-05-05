import { useEffect, useRef } from 'react';

import type { MediaItem } from '../../lib/api';
import { mediaApi } from '../../lib/api';
import { cn } from '../../lib/utils';
import { Play } from 'lucide-react';

interface ThumbnailStripProps {
  media: MediaItem[];
  currentIndex: number;
  onSelect: (item: MediaItem) => void;
}

export function ThumbnailStrip({ media, currentIndex, onSelect }: ThumbnailStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll the active thumbnail into view
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const activeEl = activeRef.current;
      
      const containerHeight = container.clientHeight;
      const elementOffset = activeEl.offsetTop;
      const elementHeight = activeEl.clientHeight;
      
      // Center the active element in the container
      const targetScrollTop = elementOffset - (containerHeight / 2) + (elementHeight / 2);

      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth'
      });
    }
  }, [currentIndex]);

  return (
    <div 
      ref={scrollRef}
      className="flex h-full w-full flex-col gap-3 overflow-y-auto px-4 py-24 scrollbar-hide snap-y snap-mandatory"
    >
      {media.map((item, index) => {
        const isActive = index === currentIndex;
        const isVideo = item.mime_type?.startsWith('video') ?? false;
        const thumbUrl = item.file_path?.startsWith('http')
          ? item.file_path
          : mediaApi.getThumbnailUrl(item.id, '200');

        return (
          <button
            key={item.id}
            ref={isActive ? activeRef : null}
            onClick={() => onSelect(item)}
            className={cn(
              "relative flex shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg transition-all duration-300 ease-out snap-center",
              isActive 
                ? "ring-2 ring-[var(--accent-green)] scale-110 shadow-lg shadow-[var(--accent-green)]/20 z-10" 
                : "opacity-40 hover:opacity-80 hover:scale-105"
            )}
            style={{ 
              aspectRatio: item.width && item.height ? `${item.width}/${item.height}` : '1/1',
            }}
          >
            <img
              src={thumbUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
            {isVideo && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <Play className="h-6 w-6 text-white" fill="currentColor" />
              </div>
            )}
            {/* Dark overlay for inactive to improve active contrast */}
            {!isActive && (
              <div className="absolute inset-0 bg-black/20" />
            )}
          </button>
        );
      })}
      
      {/* Spacer object at end to allow the last item to scroll to center */}
      <div className="h-32 shrink-0" />
    </div>
  );
}
