import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, Search, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, isValid } from 'date-fns';
import { useDebounce } from '../../hooks/useDebounce';
import { FloatingActionBar } from '../../components/explore/FloatingActionBar';
import { apiClient, mediaApi } from '../../lib/api';
import type { MediaItem } from '../../lib/api';
import { useMediaStore } from '../../stores/useMediaStore';
import { useDeleteMediaBulk } from '../../hooks/useDeleteMedia';
import { motion } from 'framer-motion';
import { Check, Video } from 'lucide-react';

const SUGGESTIONS = [
  "sunset at the beach", "birthday celebration", "mountains and snow",
  "food and meals", "passport or ID", "flowers in garden",
  "night photography", "people smiling"
];

/** Safe date formatter — never throws, never shows "Invalid Date" */
function safeFormatDate(raw: string | null | undefined): string {
  if (!raw) return '';
  try {
    // Try ISO parse first (most reliable)
    const d = parseISO(raw);
    if (isValid(d)) return format(d, 'MMM d, yyyy');
    // Fallback: native Date constructor
    const d2 = new Date(raw);
    if (isValid(d2)) return format(d2, 'MMM d, yyyy');
  } catch {
    // swallow parse errors
  }
  return '';
}

// ─── Search result card ───────────────────────────────────────────────────────
// Matches the AllMedia grid card exactly: aspect-square, same hover ring,
// same gradient overlay, same click→navigate pattern.

interface SearchCardProps {
  item: MediaItem;
  semanticScore?: number | null;
  selected: boolean;
  onToggle: (id: string) => void;
  onClick: () => void;
}

function SearchCard({ item, semanticScore, selected, onToggle, onClick }: SearchCardProps) {
  const thumbUrl = mediaApi.getThumbnailUrl(item.id, '400');
  const isVideo = item.mime_type?.startsWith('video/');
  const dateStr = safeFormatDate(item.created_at);

  const scorePercent = semanticScore ? Math.round(semanticScore * 100) : null;
  const isHighConfidence = semanticScore != null && semanticScore > 0.28;

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle(item.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      onClick={onClick}
      className={`group relative aspect-square rounded-xl overflow-hidden bg-[var(--bg-elevated)] cursor-pointer
        ring-2 transition-all duration-200 ${
          selected
            ? 'ring-[#22c982] scale-[0.97]'
            : 'ring-transparent hover:ring-white/15'
        }`}
    >
      {/* Thumbnail */}
      <img
        src={thumbUrl}
        alt={item.file_name}
        loading="lazy"
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
      />

      {/* Video badge */}
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="p-2.5 rounded-full bg-black/60 backdrop-blur-sm ring-1 ring-white/10">
            <Video size={18} className="text-white" />
          </div>
        </div>
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      {/* Bottom info */}
      <div className="absolute bottom-0 inset-x-0 p-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <p className="text-white text-[11px] font-medium truncate drop-shadow-md">{item.file_name}</p>
        {dateStr && <p className="text-white/60 text-[10px] mt-0.5">{dateStr}</p>}
      </div>

      {/* Semantic score badge */}
      {scorePercent != null && (
        <div className={`absolute top-2 right-2 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider backdrop-blur-md shadow-sm pointer-events-none ${
          isHighConfidence
            ? 'bg-[#22c982]/80 text-white'
            : 'bg-amber-500/80 text-white'
        }`}>
          {scorePercent}% Match
        </div>
      )}

      {/* Selection checkbox */}
      <div
        onClick={handleCheckboxClick}
        className={`absolute top-2 left-2 flex h-[22px] w-[22px] items-center justify-center rounded-[7px] border transition-all duration-200 cursor-pointer ${
          selected
            ? 'border-[#22c982] bg-[#22c982] text-white opacity-100'
            : 'border-white/40 bg-black/20 text-transparent opacity-0 group-hover:opacity-100 hover:border-white/80 hover:bg-black/40'
        }`}
      >
        <Check size={14} strokeWidth={3} />
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const navigate = useNavigate();
  const { setMedia } = useMediaStore();
  const bulkDeleteMutation = useDeleteMediaBulk();

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 400);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Service health — poll every 10 s while on this page
  const { data: servicesHealth } = useQuery({
    queryKey: ['services-health'],
    queryFn: () => apiClient.get('/health/services').then(r => r.data),
    refetchInterval: 10_000,
    staleTime: 5_000,
  });

  const isClipReady = servicesHealth?.services?.clip === 'ok';
  const isClipStarting = servicesHealth?.services?.clip === 'starting';

  // Search query — returns { items: MediaItem[], meta: { searchType, semanticCount, keywordCount } }
  const { data, isLoading } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: async () => {
      const res = await apiClient.get('/search', { params: { q: debouncedQuery } });
      return res.data as { items: MediaItem[]; meta: { searchType: string; semanticCount: number; keywordCount: number } };
    },
    enabled: debouncedQuery.trim().length > 0,
    staleTime: 1000 * 60 * 2,
  });

  const items: MediaItem[] = data?.items ?? [];

  const handleToggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Open fullscreen viewer — same pattern as AllMedia
  const handleCardClick = (item: MediaItem) => {
    // Populate the global media store with search results so the FullView
    // filmstrip can show prev/next within the current search context.
    setMedia(items);
    navigate(`/media/${item.id}`);
  };

  const handleClearSelection = () => setSelectedIds(new Set());

  const isSemantic = data?.meta?.searchType === 'semantic+keyword';
  const totalCount = items.length;

  return (
    <div className="flex h-full flex-col bg-[var(--bg-primary)]">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--border)] px-4 py-4 md:px-8">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </button>

        <div className="mb-2 flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Smart Search</h1>
          <div className="flex items-center gap-1.5 rounded-full bg-[#22c982]/10 px-3 py-1 text-[#22c982]">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">AI-Powered</span>
          </div>
        </div>
        <p className="mb-6 text-[var(--text-secondary)] tracking-wide">Search your photos using natural language</p>

        <div className="mb-8 h-1 w-24 rounded-full bg-gradient-to-r from-[#22c982] to-blue-500" />

        {/* Search Input */}
        <div className="relative max-w-3xl">
          <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
            <Search className="h-6 w-6 text-[var(--text-muted)]" />
          </div>
          <input
            type="text"
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] py-4 pl-12 pr-4 text-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[#22c982] focus:outline-none focus:ring-1 focus:ring-[#22c982] transition-shadow"
            placeholder="E.g. dog playing in the park..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        {/* CLIP status pill */}
        {!isClipReady && (
          <div
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm mt-4"
            style={{
              background: 'var(--color-bg-surface)',
              border: '1px solid rgba(236, 238, 245, 0.06)',
              color: 'rgba(236, 238, 245, 0.5)',
            }}
          >
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: isClipStarting ? '#e8a228' : '#f05050' }}
            />
            {isClipStarting
              ? 'AI engine is starting up — keyword search available now, semantic search ready in ~60s'
              : 'AI engine unavailable — showing keyword results only'}
          </div>
        )}
      </div>

      {/* ── Main Content ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">

        {/* Suggestions (empty state) */}
        {debouncedQuery.trim().length === 0 && (
          <div className="max-w-3xl pt-8">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Try searching for</h3>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => setQuery(s)}
                  className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:border-[#22c982] hover:text-[#22c982] transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading skeletons */}
        {isLoading && debouncedQuery.trim().length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 18 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square w-full rounded-xl bg-[var(--bg-elevated)] animate-pulse"
                style={{ animationDelay: `${i * 30}ms` }}
              />
            ))}
          </div>
        )}

        {/* Result metadata bar */}
        {!isLoading && data && (
          <div className="mb-5 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {totalCount} {totalCount === 1 ? 'result' : 'results'} for &ldquo;{debouncedQuery}&rdquo;
            </span>
            {isSemantic ? (
              <span className="text-xs text-[#22c982] bg-[#22c982]/10 px-2 py-1 rounded-full border border-[#22c982]/20">
                ✦ Semantic search active
              </span>
            ) : (
              <span className="text-xs text-amber-500 bg-amber-500/10 px-2 py-1 rounded-full border border-amber-500/20">
                Semantic index building — keyword results shown
              </span>
            )}
          </div>
        )}

        {/* Empty results */}
        {!isLoading && data && totalCount === 0 && debouncedQuery.trim().length > 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 rounded-full bg-[var(--bg-elevated)] p-5 text-[var(--text-muted)]">
              <Search className="h-9 w-9" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-[var(--text-primary)]">No matches found</h3>
            <p className="text-[var(--text-secondary)] max-w-md">
              We couldn&apos;t find any photos matching &ldquo;{debouncedQuery}&rdquo;. Try using different keywords or broader concepts.
            </p>
          </div>
        )}

        {/* Results grid */}
        {!isLoading && totalCount > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 pb-24">
            {items.map((item) => (
              <SearchCard
                key={item.id}
                item={item}
                semanticScore={item.semanticScore ?? null}
                selected={selectedIds.has(item.id)}
                onToggle={handleToggle}
                onClick={() => handleCardClick(item)}
              />
            ))}
          </div>
        )}
      </div>

      <FloatingActionBar
        count={selectedIds.size}
        onDeselect={handleClearSelection}
        onDelete={() => {
          const idsToDelete = Array.from(selectedIds);
          if (window.confirm(`Move ${idsToDelete.length} photo${idsToDelete.length !== 1 ? 's' : ''} to trash?`)) {
            // Optimistic bulk delete — fires synchronously, then network call
            bulkDeleteMutation.mutate(idsToDelete, {
              onSuccess: () => setSelectedIds(new Set()),
            });
          }
        }}
        isDeleting={bulkDeleteMutation.isPending}
      />
    </div>
  );
}
