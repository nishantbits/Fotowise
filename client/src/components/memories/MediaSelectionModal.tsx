import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAllMedia } from '../../lib/api';
import { mediaApi } from '../../lib/api';
import type { MediaItem } from '../../lib/api';
import { Check, X, Search, Image, Film, SlidersHorizontal, Loader2 } from 'lucide-react';

interface MediaSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedIds: string[]) => void;
  initialSelectedIds?: string[];
}

type FilterType = 'all' | 'photos' | 'videos';

export const MediaSelectionModal: React.FC<MediaSelectionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialSelectedIds = [],
}) => {
  const [allMedia, setAllMedia] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');

  // Fetch the FULL library every time the modal opens.
  // We deliberately bypass the media store here because it may only hold the
  // first page (100 items). getAllMedia() pages through until every item is loaded.
  const fetchLibrary = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const items = await getAllMedia();
      setAllMedia(items);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load library');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(initialSelectedIds);
      setSearchQuery('');
      setFilterType('all');
      fetchLibrary();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const filteredMedia = useMemo(() => {
    let items = allMedia;

    if (filterType === 'photos') {
      items = items.filter(item => item.mime_type?.startsWith('image/'));
    } else if (filterType === 'videos') {
      items = items.filter(item => item.mime_type?.startsWith('video/'));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(item => item.file_name?.toLowerCase().includes(q));
    }

    return items;
  }, [allMedia, searchQuery, filterType]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const allFilteredIds = filteredMedia.map(item => item.id);
    const allSelected = allFilteredIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...allFilteredIds])]);
    }
  };

  const filterButtons: { key: FilterType; label: string; icon: React.ReactNode }[] = [
    { key: 'all',    label: 'All',    icon: <SlidersHorizontal size={14} /> },
    { key: 'photos', label: 'Photos', icon: <Image size={14} /> },
    { key: 'videos', label: 'Videos', icon: <Film size={14} /> },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[750] flex items-center justify-center p-4 md:p-6 bg-black/85 backdrop-blur-lg">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="bg-[#1a1a1e] border border-white/10 rounded-3xl md:rounded-[40px] max-w-5xl w-full h-[85vh] md:h-[80vh] flex flex-col shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex-shrink-0 px-6 md:px-8 pt-6 md:pt-8 pb-4">
              <div className="flex justify-between items-start mb-5">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Select Media</h2>
                  <p className="text-white/50 text-sm mt-1">
                    {isLoading
                      ? 'Loading your library…'
                      : selectedIds.length > 0
                        ? <><span className="text-accent font-semibold">{selectedIds.length}</span> item{selectedIds.length !== 1 ? 's' : ''} selected</>
                        : `${allMedia.length.toLocaleString()} items available — choose photos & videos`
                    }
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2.5 rounded-xl hover:bg-white/10 text-white/50 hover:text-white transition-all"
                >
                  <X size={22} />
                </button>
              </div>

              {/* Search + Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by filename…"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent/50 focus:bg-white/8 transition-all"
                    disabled={isLoading}
                  />
                </div>

                <div className="flex gap-1.5 bg-white/5 rounded-xl p-1 border border-white/5">
                  {filterButtons.map(btn => (
                    <button
                      key={btn.key}
                      onClick={() => setFilterType(btn.key)}
                      disabled={isLoading}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40 ${
                        filterType === btn.key
                          ? 'bg-accent text-black shadow-sm'
                          : 'text-white/50 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {btn.icon}
                      {btn.label}
                    </button>
                  ))}
                </div>

                {!isLoading && filteredMedia.length > 0 && (
                  <button
                    onClick={handleSelectAll}
                    className="px-3.5 py-2 rounded-xl border border-white/10 text-xs font-medium text-white/60 hover:text-white hover:bg-white/5 transition-all whitespace-nowrap"
                  >
                    {filteredMedia.every(item => selectedIds.includes(item.id))
                      ? 'Deselect All'
                      : 'Select All'}
                  </button>
                )}
              </div>
            </div>

            {/* Grid Content */}
            <div className="flex-1 overflow-y-auto px-6 md:px-8 pb-4 scrollbar-thin">
              {isLoading ? (
                /* Loading skeleton */
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 md:gap-2.5">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-square rounded-xl bg-white/5 animate-pulse"
                      style={{ animationDelay: `${i * 30}ms` }}
                    />
                  ))}
                </div>
              ) : fetchError ? (
                <div className="flex flex-col items-center justify-center h-full py-16 gap-4">
                  <div className="w-16 h-16 rounded-3xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                    <X className="w-7 h-7 text-red-400" />
                  </div>
                  <p className="text-white/60 text-base font-medium">Failed to load library</p>
                  <p className="text-white/30 text-sm">{fetchError}</p>
                  <button
                    onClick={fetchLibrary}
                    className="mt-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 text-sm font-medium transition-all"
                  >
                    Retry
                  </button>
                </div>
              ) : filteredMedia.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-16">
                  <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mb-5 border border-white/5">
                    <Image className="w-8 h-8 text-white/20" />
                  </div>
                  <p className="text-white/50 text-base font-medium mb-1">
                    {searchQuery ? 'No results found' : 'Your library is empty'}
                  </p>
                  <p className="text-white/30 text-sm">
                    {searchQuery
                      ? `No media matching "${searchQuery}"`
                      : 'Upload some photos first to create a memory'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 md:gap-2.5">
                  {filteredMedia.map(item => {
                    const isSelected = selectedIds.includes(item.id);
                    const isVideo = item.mime_type?.startsWith('video/');
                    const selectionOrder = isSelected ? selectedIds.indexOf(item.id) + 1 : null;

                    return (
                      <motion.div
                        key={item.id}
                        onClick={() => toggleSelect(item.id)}
                        whileTap={{ scale: 0.97 }}
                        className={`group relative aspect-square rounded-xl md:rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 ${
                          isSelected
                            ? 'ring-2 ring-accent ring-offset-2 ring-offset-[#1a1a1e] scale-[0.96]'
                            : 'hover:ring-1 hover:ring-white/20'
                        }`}
                      >
                        <img
                          src={mediaApi.getThumbnailUrl(item.id, '200')}
                          alt={item.file_name}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />

                        <div className={`absolute inset-0 transition-opacity duration-200 ${
                          isSelected ? 'bg-accent/10' : 'bg-black/0 group-hover:bg-black/30'
                        }`} />

                        <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/70 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <p className="text-[10px] text-white/90 truncate font-medium">{item.file_name}</p>
                        </div>

                        {isVideo && (
                          <div className="absolute top-1.5 left-1.5 p-1 rounded-md bg-black/60 backdrop-blur-sm">
                            <Film size={12} className="text-white/80" />
                          </div>
                        )}

                        <div className={`absolute top-1.5 right-1.5 transition-all duration-200 ${
                          isSelected ? 'scale-100 opacity-100' : 'scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100'
                        }`}>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors shadow-lg ${
                            isSelected
                              ? 'bg-accent text-black'
                              : 'bg-black/50 text-white border border-white/30 backdrop-blur-sm'
                          }`}>
                            {isSelected
                              ? (selectionOrder && selectionOrder <= 99 ? selectionOrder : <Check size={12} strokeWidth={3} />)
                              : <Check size={12} strokeWidth={2} />}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 flex items-center justify-between px-6 md:px-8 py-4 border-t border-white/5 bg-[#1a1a1e]">
              <p className="text-xs text-white/30 flex items-center gap-2">
                {isLoading
                  ? <><Loader2 size={12} className="animate-spin" /> Fetching library…</>
                  : <>{filteredMedia.length.toLocaleString()} item{filteredMedia.length !== 1 ? 's' : ''} shown</>
                }
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => onConfirm(selectedIds)}
                  disabled={selectedIds.length === 0}
                  className="px-6 py-2.5 rounded-xl bg-accent text-black text-sm font-semibold hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none shadow-lg shadow-accent/20"
                >
                  Add {selectedIds.length > 0 ? `${selectedIds.length} ` : ''}to Memory
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
