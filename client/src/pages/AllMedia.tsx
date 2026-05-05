import { useState, useRef, useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { MediaItem } from '../lib/api';
import { Image as ImageIcon, Video, X } from 'lucide-react';
import { mediaApi } from '../lib/api';
import { useMediaStore } from '../stores/useMediaStore';

type Filter = 'all' | 'photos' | 'videos';

function MediaCard({
  item,
  onClick,
}: {
  item: MediaItem;
  onClick: () => void;
}) {
  const isVideo = item.mime_type?.startsWith('video/');
  const thumbUrl = mediaApi.getThumbnailUrl(item.id, '400');

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      onClick={onClick}
      className="group relative aspect-square rounded-xl overflow-hidden bg-[var(--bg-elevated)] ring-1 ring-white/5 hover:ring-[var(--accent)]/40 transition-all duration-300 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
    >
      <img
        src={thumbUrl}
        alt={item.file_name}
        loading="lazy"
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
      />
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="p-2.5 rounded-full bg-black/60 backdrop-blur-sm ring-1 ring-white/10">
            <Video size={18} className="text-white" />
          </div>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <p className="text-white text-xs font-medium truncate drop-shadow-md">{item.file_name}</p>
      </div>
      {item.is_favorite === 1 && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-yellow-400/90 flex items-center justify-center shadow-sm">
          <span className="text-[10px]">★</span>
        </div>
      )}
    </motion.button>
  );
}

export default function AllMedia() {
  // Sync filter with URL search params for back-button state preservation
  const [searchParams, setSearchParams] = useSearchParams();
  const filterParam = (searchParams.get('filter') as Filter) || 'all';
  const [filter, setFilter] = useState<Filter>(filterParam);

  const navigate = useNavigate();
  const { setMedia } = useMediaStore();
  const observerTarget = useRef<HTMLDivElement | null>(null);

  // Keep URL in sync with filter state
  const handleSetFilter = (f: Filter) => {
    setFilter(f);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (f === 'all') {
          next.delete('filter');
        } else {
          next.set('filter', f);
        }
        return next;
      },
      { replace: true }
    );
  };

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    useInfiniteQuery({
      queryKey: ['all-media'],
      queryFn: async ({ pageParam = 1 }) => {
        const res = await mediaApi.getMedia(pageParam as number, 60);
        return res;
      },
      getNextPageParam: (last) => {
        const { page, totalPages } = last.pagination;
        return page < totalPages ? page + 1 : undefined;
      },
      initialPageParam: 1,
    });

  // Flatten all pages into a single item list, applying client-side filter
  const allItems: MediaItem[] = (data?.pages ?? [])
    .flatMap((p) => p.data)
    .filter((item) => {
      if (filter === 'photos') return !item.mime_type?.startsWith('video/');
      if (filter === 'videos') return item.mime_type?.startsWith('video/');
      return true;
    });

  // When a card is clicked: load the full media list into the global store,
  // then navigate to the FullView route so the custom filmstrip viewer is used.
  const handleCardClick = (item: MediaItem) => {
    // Load all currently-fetched items into the media store so FullView can
    // show the ThumbnailStrip. The store update is synchronous, so navigation
    // is safe to call immediately after.
    const allFetched: MediaItem[] = (data?.pages ?? []).flatMap((p) => p.data);
    setMedia(allFetched);
    navigate(`/media/${item.id}`);
  };

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const node = observerTarget.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '300px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const totalItems = data?.pages[0]?.pagination?.totalItems;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[var(--bg)]">
      {/* Header */}
      <div className="shrink-0 px-6 pt-8 pb-5 border-b border-[var(--border)]">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--t1)] font-display">
              All Media
            </h1>
            <p className="text-[var(--t2)] text-sm mt-1">
              {totalItems != null ? `${totalItems.toLocaleString()} items in your library` : 'Loading library…'}
            </p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2">
          {([
            { key: 'all' as Filter, label: 'All', icon: null },
            { key: 'photos' as Filter, label: 'Photos', icon: <ImageIcon size={13} /> },
            { key: 'videos' as Filter, label: 'Videos', icon: <Video size={13} /> },
          ]).map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => handleSetFilter(key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                filter === key
                  ? 'bg-[var(--accent)] text-black shadow-lg shadow-[var(--accent)]/25'
                  : 'bg-[var(--bg-surface)] text-[var(--t2)] hover:bg-[var(--bg-elevated)] hover:text-[var(--t1)]'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {Array.from({ length: 30 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square rounded-xl bg-[var(--bg-surface)] animate-pulse"
                style={{ animationDelay: `${i * 40}ms` }}
              />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="p-6 rounded-full bg-red-500/10">
              <X size={40} className="text-red-400" />
            </div>
            <p className="text-[var(--t1)] text-lg font-medium">Failed to load media</p>
            <p className="text-[var(--t2)] text-sm">Check your connection and try again.</p>
          </div>
        ) : allItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="p-6 rounded-full bg-[var(--bg-surface)]">
              <ImageIcon size={40} className="text-[var(--t3)]" />
            </div>
            <p className="text-[var(--t1)] text-lg font-medium">No media found</p>
            <p className="text-[var(--t2)] text-sm">
              {filter !== 'all' ? 'Try switching to a different filter.' : 'Add photos or videos to your library to see them here.'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {allItems.map((item) => (
                <MediaCard
                  key={item.id}
                  item={item}
                  onClick={() => handleCardClick(item)}
                />
              ))}
            </div>

            {/* Infinite scroll sentinel */}
            <div ref={observerTarget} className="h-24 flex items-center justify-center mt-4">
              {isFetchingNextPage && (
                <div className="flex gap-2">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full bg-[var(--accent)] animate-bounce"
                      style={{ animationDelay: `${i * 0.12}s` }}
                    />
                  ))}
                </div>
              )}
              {!hasNextPage && allItems.length > 0 && (
                <p className="text-[var(--t3)] text-sm font-medium">You've reached the end ✓</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
