import { useEffect } from 'react';
import { Search, X, Loader2, Image as ImageIcon, Video } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSearchStore } from '../../stores/useSearchStore';
import { mediaApi } from '../../lib/api';
import { Input } from '../ui/Input';

export function SearchOverlay() {
  const { 
    query, 
    setQuery, 
    isSearchOverlayOpen, 
    setSearchOverlayOpen, 
    results, 
    isSearching, 
    performSearch 
  } = useSearchStore();
  
  const navigate = useNavigate();

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSearchOverlayOpen(false);
    };
    if (isSearchOverlayOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOverlayOpen, setSearchOverlayOpen]);

  if (!isSearchOverlayOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[var(--bg-primary)]/95 backdrop-blur-md">
      {/* Search Header */}
      <div className="flex items-center gap-4 border-b border-[var(--border)] p-4 md:px-8 h-20">
        <Search className="h-6 w-6 text-[var(--accent-green)] flex-shrink-0" />
        <Input
          autoFocus
          className="flex-1 border-none bg-transparent text-xl md:text-2xl shadow-none focus-visible:ring-0 px-0 placeholder:text-[var(--text-muted)]"
          placeholder="Search by AI tags, titles, dates, or file names..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {isSearching && <Loader2 className="h-5 w-5 animate-spin text-[var(--text-secondary)]" />}
        <button 
          onClick={() => setSearchOverlayOpen(false)}
          className="rounded-full p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-white transition-colors"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Results Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        {results.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {results.map((media) => (
              <div 
                key={media.id}
                onClick={() => {
                  setSearchOverlayOpen(false);
                  navigate(`/media/${media.id}`); // Assuming FullView is accessible via global route, or explore
                }}
                className="group relative cursor-pointer overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] aspect-square"
              >
                <img 
                  src={mediaApi.getThumbnailUrl(media.id, '400')} 
                  alt={media.file_name}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                
                {/* Meta overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-6 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <div className="flex items-center gap-2 text-white">
                    {media.mime_type.startsWith('video') ? <Video className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                    <span className="truncate text-xs font-medium">{media.exif_model || media.file_name.split('.')[0]}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : query.length > 0 && !isSearching ? (
          <div className="flex h-full flex-col items-center justify-center text-[var(--text-secondary)]">
            <Search className="mb-4 h-12 w-12 opacity-20" />
            <p className="text-lg font-medium">No results found for "{query}"</p>
            <p className="text-sm opacity-60">Try searching for different tags or names.</p>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-[var(--text-muted)]">
            <Search className="mb-4 h-12 w-12 opacity-10" />
            <p className="text-lg">Type to start searching your library</p>
          </div>
        )}
      </div>
    </div>
  );
}
