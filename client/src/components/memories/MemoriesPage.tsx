import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { MemoryEntryCard } from './MemoryEntryCard';
import type { MemoryData } from './MemoryEntryCard';
import { PhotoReorder } from './PhotoReorder';
import { MemoryCanvas } from './MemoryCanvas';
import type { Box } from './MemoryCanvas';
import { PhotoCard } from './PhotoCard';
import { Sparkles, Plus } from 'lucide-react';
import { mediaApi, memoriesApi } from '../../lib/api';
import type { MediaItem } from '../../lib/api';
import { MediaSelectionModal } from './MediaSelectionModal';
import { useMediaStore } from '../../stores/useMediaStore';
import { useToastStore } from '../../stores/useToastStore';
import { ConfirmDialog } from '../ui/ConfirmDialog';

// Simple deterministic PRNG
const mulberry32 = (a: number) => {
  return function() {
      let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

// Generate deterministic layout
const generateLayout = (
  memoryId: string,
  photos: { id: string; imgUrl: string; isVideo: boolean }[]
): (Box & { imgUrl: string; rotation: number; isVideo: boolean })[] => {
  const seed = Array.from(memoryId).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const random = mulberry32(seed);
  
  const boxes = [];
  const count = photos.length;
  
  for (let i = 0; i < count; i++) {
    // Determine size tier
    const r = random();
    let width;
    if (r < 0.2) {
      width = 380 + random() * 100; // Large 380-480
    } else if (r < 0.7) {
      width = 220 + random() * 80;  // Medium 220-300
    } else {
      width = 120 + random() * 40;  // Small 120-160
    }

    // Use safe viewport values so we don't crash in non-browser environments
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
    const isMobile = viewportWidth < 768;
    if (isMobile) {
      width *= 0.65;
    }
    
    // Maintain ~ 4:3 or 3:4 aspect roughly
    const height = width * (random() > 0.5 ? 1.33 : 0.75);
    
    // Rotation -4 to +4
    const rotation = (random() * 8) - 4;
    
    // Position (naive clustering and overlap prevention placeholder)
    const angle = i * 2.4;
    const radius = Math.sqrt(i) * 120 * (isMobile ? 0.65 : 1);
    
    // Slight random offset
    let x = viewportWidth / 2 + Math.cos(angle) * radius + (random() * 100 - 50);
    let y = viewportHeight / 2 + Math.sin(angle) * radius + (random() * 100 - 50);
    
    // For hero photo (index 0), explicitly place at center
    if (i === 0) {
      x = viewportWidth / 2 - width / 2;
      y = viewportHeight / 2 - height / 2;
    } else {
      x -= width / 2;
      y -= height / 2;
    }

    const photo = photos[i];
    
    boxes.push({
      id: i === 0 ? `memory-hero-${memoryId}` : photo.id,
      x,
      y,
      width,
      height,
      rotation,
      imgUrl: photo.imgUrl,
      isVideo: photo.isVideo,
      color: '#fff'
    });
  }
  
  console.log('[generateLayout] Generated boxes:', boxes.length);
  return boxes;
};

export const MemoriesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createStep, setCreateStep] = useState<0 | 1 | 2>(0);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<MemoryData | null>(null);
  const [memories, setMemories] = useState<MemoryData[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newDateRange, setNewDateRange] = useState('');
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [isSelectingMedia, setIsSelectingMedia] = useState(false);
  const [exploredMemoryPhotos, setExploredMemoryPhotos] = useState<any[]>([]);
  const [isMemoryLoading, setIsMemoryLoading] = useState(false);
  const { setMedia } = useMediaStore();
  const addToast = useToastStore((s) => s.addToast);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [memoryToDelete, setMemoryToDelete] = useState<string | null>(null);

  const exploredMemoryId = searchParams.get('explore');
  const [currentIndex, setCurrentIndex] = useState(0);

  const setExploredMemoryId = (id: string | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (id) {
        next.set('explore', id);
      } else {
        next.delete('explore');
      }
      return next;
    }, { replace: true });
  };
  
  const currentMemory = memories[currentIndex];

  const totalSlides = memories.length + 1; // +1 for the "Create New Memory" slide

  const handleNext = () => {
    if (memories.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % totalSlides);
  };

  const handlePrev = () => {
    if (memories.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  const layoutItems = useMemo(() => {
    if (!exploredMemoryId || !exploredMemoryPhotos || exploredMemoryPhotos.length === 0) return [];
    
    const photosWithUrls = exploredMemoryPhotos
      .filter((p: any) => p && p.id)
      .map((p: any) => ({
      id: p.id,
      imgUrl: mediaApi.getThumbnailUrl(p.id, '800'),
      isVideo: Boolean(p.mime_type && p.mime_type.startsWith('video/'))
    }));

    console.log('[layoutItems memo] Initial photos:', exploredMemoryPhotos?.length, 'Filtered with URLs:', photosWithUrls.length);

    if (photosWithUrls.length === 0) return [];

    return generateLayout(exploredMemoryId, photosWithUrls);
  }, [exploredMemoryId, exploredMemoryPhotos]);

  const dummyList = useMemo(() => {
    if (!exploredMemoryId || !exploredMemoryPhotos) return [];
    return exploredMemoryPhotos
      .filter((item: any) => item && item.id)
      .map((item: any): MediaItem => ({
        id: item.id,
        file_name: item.file_name || 'Unknown',
        file_path: item.file_path || '',
        file_size: item.file_size ?? 0,
        mime_type: item.mime_type || 'image/jpeg',
        width: item.width ?? 0,
        height: item.height ?? 0,
        created_at: item.created_at || new Date().toISOString(),
        imported_at: item.imported_at || new Date().toISOString(),
        blur_score: item.blur_score ?? 0,
        is_screenshot: item.is_screenshot ?? 0,
        is_deleted: item.is_deleted ?? 0,
        is_favorite: item.is_favorite ?? 0,
        exif_make: item.exif_make,
        exif_model: item.exif_model,
      }));
  }, [exploredMemoryId, exploredMemoryPhotos]);

  useEffect(() => {
    const loadMemories = async () => {
      try {
        const data = await memoriesApi.getMemories();
        const formatted = data.map(m => ({
          ...m,
          coverPhotos: m.coverPhotos.map(id => mediaApi.getThumbnailUrl(id, '400'))
        }));
        setMemories(formatted);
      } catch (error) {
        console.error('Failed to load memories:', error);
      }
    };
    loadMemories();

    const loadMediaFallback = async () => {
      if (useMediaStore.getState().media.length === 0) {
        try {
          const mediaData = await mediaApi.getMedia(1, 100);
          setMedia(mediaData.data);
        } catch (error) {
          console.error('Failed to load base media fallback:', error);
        }
      }
    };
    loadMediaFallback();
  }, [setMedia]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle keyboard nav when not in explore mode and not in create modal
      if (exploredMemoryId || createStep > 0 || isSelectingMedia || isEditModalOpen) return;

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          handleNext();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          handlePrev();
          break;
        case 'Enter':
          e.preventDefault();
          if (currentIndex < memories.length && currentMemory) {
            setExploredMemoryId(currentMemory.id);
          } else if (currentIndex === memories.length) {
            handleOpenCreateModal();
          }
          break;
        case 'Delete':
        case 'Backspace':
          if (currentIndex < memories.length && currentMemory && !e.repeat) {
            e.preventDefault();
            handleDeleteMemory(currentMemory.id);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [exploredMemoryId, createStep, isSelectingMedia, isEditModalOpen, memories.length, currentIndex, currentMemory]);

  useEffect(() => {
    if (exploredMemoryId) {
      const loadDetails = async () => {
        setIsMemoryLoading(true);
        try {
          const data = await memoriesApi.getMemory(exploredMemoryId);
          setExploredMemoryPhotos(data.photos || []);
        } catch (error: any) {
          console.error('Failed to load memory details:', error);
          const backendError = error.response?.data?.error || error.message;
          alert(`Failed to load memory photos: ${backendError}`);
          setExploredMemoryPhotos([]);
        } finally {
          setIsMemoryLoading(false);
        }
      };
      loadDetails();
    } else {
      setExploredMemoryPhotos([]);
      setIsMemoryLoading(false);
    }
  }, [exploredMemoryId]);

  const handleOpenCreateModal = () => {
    setNewTitle('');
    setNewSubtitle('');
    setNewDateRange('');
    setSelectedMediaIds([]);
    setCreateStep(1);
    setIsSelectingMedia(true);
  };

  const handleCreateMemory = async () => {
    const title = newTitle.trim() || 'Untitled Memory';
    const subtitle = newSubtitle.trim() || 'Handpicked from your library';
    const dateRange = newDateRange.trim() || 'Custom range';

    if (selectedMediaIds.length === 0) {
      alert('Please select at least one photo.');
      return;
    }

    try {
      const response = await memoriesApi.createMemory({
        title,
        subtitle,
        dateRange,
        mediaIds: selectedMediaIds
      });

      if (response.success) {
        const data = await memoriesApi.getMemories();
        const formatted = data.map(m => ({
          ...m,
          coverPhotos: m.coverPhotos.map(id => mediaApi.getThumbnailUrl(id, '400'))
        }));
        setMemories(formatted);
        setCurrentIndex(0);
        setCreateStep(0);
        setNewTitle('');
        setNewSubtitle('');
        setNewDateRange('');
        setSelectedMediaIds([]);
      } else {
        alert('Failed to save memory. Response indicated failure.');
      }
    } catch (error: any) {
      console.error('Failed to create memory:', error);
      const backendError = error.response?.data?.error || error.message;
      alert(`Failed to save memory: ${backendError}`);
    }
  };

  const handleDeleteMemory = async (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setMemoryToDelete(id);
    setIsConfirmOpen(true);
  };

  const confirmDeleteMemory = async () => {
    if (!memoryToDelete) return;
    const id = memoryToDelete;
    setIsConfirmOpen(false);
    setMemoryToDelete(null);

    try {
      const response = await memoriesApi.deleteMemory(id);
      if (response && response.success) {
        setMemories(prev => prev.filter(m => m.id !== id));
        setCurrentIndex(prev => {
          if (prev >= memories.length - 1 && prev > 0) return prev - 1;
          return prev;
        });
        addToast('Memory deleted successfully', 'success');
      } else {
        addToast('Failed to delete memory. Please try again.', 'error');
      }
    } catch (error: any) {
      console.error('Failed to delete memory:', error);
      const backendError = error.response?.data?.error || error.message || 'Unknown error';
      addToast(`Delete failed: ${backendError}`, 'error');
    }
  };

  const handleEditMemory = (memory: MemoryData) => {
    setEditingMemory(memory);
    setNewTitle(memory.title);
    setNewSubtitle(memory.subtitle);
    setNewDateRange(memory.dateRange);
    // Get current media IDs from the memory's photos
    const loadMemoryMedia = async () => {
      try {
        const data = await memoriesApi.getMemory(memory.id);
        setSelectedMediaIds(data.photos.map((p: any) => p.id));
      } catch (error) {
        console.error('Failed to load memory media:', error);
      }
    };
    loadMemoryMedia();
    setIsEditModalOpen(true);
  };

  const handleUpdateMemory = async () => {
    if (!editingMemory) return;

    const title = newTitle.trim() || editingMemory.title;
    const subtitle = newSubtitle.trim();
    const dateRange = newDateRange.trim();

    if (selectedMediaIds.length === 0) {
      alert('Please select at least one photo.');
      return;
    }

    try {
      const response = await memoriesApi.updateMemory(editingMemory.id, {
        title,
        subtitle,
        dateRange,
        mediaIds: selectedMediaIds
      });

      if (response.success) {
        const data = await memoriesApi.getMemories();
        const formatted = data.map(m => ({
          ...m,
          coverPhotos: m.coverPhotos.map(id => mediaApi.getThumbnailUrl(id, '400'))
        }));
        setMemories(formatted);
        setIsEditModalOpen(false);
        setEditingMemory(null);
        setNewTitle('');
        setNewSubtitle('');
        setNewDateRange('');
        setSelectedMediaIds([]);
      } else {
        alert('Failed to update memory. Response indicated failure.');
      }
    } catch (error: any) {
      console.error('Failed to update memory:', error);
      const backendError = error.response?.data?.error || error.message;
      alert(`Failed to update memory: ${backendError}`);
    }
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingMemory(null);
    setNewTitle('');
    setNewSubtitle('');
    setNewDateRange('');
    setSelectedMediaIds([]);
  };

  return (
    <div className="relative w-full h-full flex-1 bg-bg-primary flex flex-col justify-center overflow-hidden">
      
      {/* Empty State / Create Memory Card */}
      {!exploredMemoryId && memories.length === 0 && (
        <div className="flex flex-col items-center justify-center p-8 max-w-2xl mx-auto text-center animate-in fade-in zoom-in duration-700">
          <div className="w-24 h-24 rounded-full bg-accent/10 flex items-center justify-center mb-8 border border-accent/20">
            <Sparkles className="w-10 h-10 text-accent animate-pulse" />
          </div>
          <h1 className="text-4xl font-display font-bold text-t1 mb-4">Your Memories Space</h1>
          <p className="text-t2 text-lg mb-10 leading-relaxed">
            Fotowise uses intelligence to automatically detect special events and milestones from your photos. These will appear here as they are discovered.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            <div 
              onClick={handleOpenCreateModal}
              className="p-8 rounded-[32px] bg-bg-surface border border-white/5 hover:border-accent/40 hover:bg-bg-elevated transition-all cursor-pointer group text-left"
            >
              <div className="w-12 h-12 rounded-2xl bg-accent/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Plus className="text-accent" />
              </div>
              <h3 className="text-xl font-bold text-t1 mb-2">Create Custom Memory</h3>
              <p className="text-t3 text-sm">Select dates and media to manually curate a specific moment.</p>
            </div>
            
            <div className="p-8 rounded-[32px] bg-bg-surface/40 border border-white/5 opacity-80 text-left">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                <Sparkles className="text-t3" size={20} />
              </div>
              <h3 className="text-xl font-bold text-t3 mb-2">Auto-Curation</h3>
              <p className="text-t3 text-sm italic">"Memories will be automatically updated after detecting events in your library."</p>
            </div>
          </div>
        </div>
      )}

      {/* Creation Modal - Step 2 */}
      <AnimatePresence>
        {createStep === 2 && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-bg-surface flex flex-col border border-white/10 rounded-[32px] md:rounded-[40px] p-6 md:p-10 max-w-xl w-full max-h-[90vh] overflow-y-auto scrollbar-thin shadow-2xl"
            >
              <div className="flex flex-col gap-6">
                <div>
                  <h2 className="text-2xl font-bold text-t1 mb-2">Configure Memory Details</h2>
                  <p className="text-t2 text-sm">
                    Give this moment a name and Fotowise will frame it with a cinematic, multi-photo layout using your library.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-t3">
                      Title
                    </label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Summer on the coast"
                      className="w-full rounded-2xl border border-white/10 bg-bg-primary px-4 py-2.5 text-sm text-t1 focus:outline-none focus:ring-2 focus:ring-accent"
                    />

                    <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.16em] text-t3">
                      Subtitle
                    </label>
                    <input
                      type="text"
                      value={newSubtitle}
                      onChange={(e) => setNewSubtitle(e.target.value)}
                      placeholder="Weekend escapes and golden hours"
                      className="w-full rounded-2xl border border-white/10 bg-bg-primary px-4 py-2.5 text-sm text-t1 focus:outline-none focus:ring-2 focus:ring-accent"
                    />

                    <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.16em] text-t3">
                      Date range label
                    </label>
                    <input
                      type="text"
                      value={newDateRange}
                      onChange={(e) => setNewDateRange(e.target.value)}
                      placeholder="July – August 2024"
                      className="w-full rounded-2xl border border-white/10 bg-bg-primary px-4 py-2.5 text-sm text-t1 focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl border border-white/10 bg-bg-primary/60">
                      <p className="text-sm font-medium text-t1 mb-3">
                        Photos
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsSelectingMedia(true)}
                        className="w-full py-3 rounded-xl border border-dashed border-white/20 hover:border-accent/40 text-sm font-medium text-t2 hover:text-accent transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus size={16} />
                        {selectedMediaIds.length > 0 ? `Selected ${selectedMediaIds.length} Photos` : 'Select Photos from Library'}
                      </button>
                      <p className="mt-2 text-[11px] text-t3">
                        Choose the photos and videos you want to include in this memory.
                      </p>
                    </div>

                    {selectedMediaIds.length > 0 && (
                      <PhotoReorder
                        photoIds={selectedMediaIds}
                        onReorder={(newOrder) => setSelectedMediaIds(newOrder)}
                      />
                    )}

                    <div className="p-4 rounded-2xl border border-accent/20 bg-accent/5">
                      <p className="text-[11px] text-accent font-medium">
                        Tip: For the most premium look, upload a small set of your favorite shots first, then build a memory around them.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setCreateStep(0)}
                    className="px-4 py-2.5 rounded-2xl border border-white/10 text-sm font-medium text-t2 hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateMemory}
                    className="px-5 py-2.5 rounded-2xl bg-accent text-black text-sm font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform"
                  >
                    Save Memory
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {isEditModalOpen && editingMemory && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-bg-surface flex flex-col border border-white/10 rounded-[32px] md:rounded-[40px] p-6 md:p-10 max-w-xl w-full max-h-[90vh] overflow-y-auto scrollbar-thin shadow-2xl"
            >
              <div className="flex flex-col gap-6">
                <div>
                  <h2 className="text-2xl font-bold text-t1 mb-2">Edit Memory</h2>
                  <p className="text-t2 text-sm">
                    Update your memory details and photos.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-t3">
                      Title
                    </label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Summer on the coast"
                      className="w-full rounded-2xl border border-white/10 bg-bg-primary px-4 py-2.5 text-sm text-t1 focus:outline-none focus:ring-2 focus:ring-accent"
                    />

                    <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.16em] text-t3">
                      Subtitle
                    </label>
                    <input
                      type="text"
                      value={newSubtitle}
                      onChange={(e) => setNewSubtitle(e.target.value)}
                      placeholder="Weekend escapes and golden hours"
                      className="w-full rounded-2xl border border-white/10 bg-bg-primary px-4 py-2.5 text-sm text-t1 focus:outline-none focus:ring-2 focus:ring-accent"
                    />

                    <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.16em] text-t3">
                      Date range label
                    </label>
                    <input
                      type="text"
                      value={newDateRange}
                      onChange={(e) => setNewDateRange(e.target.value)}
                      placeholder="July – August 2024"
                      className="w-full rounded-2xl border border-white/10 bg-bg-primary px-4 py-2.5 text-sm text-t1 focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl border border-white/10 bg-bg-primary/60">
                      <p className="text-sm font-medium text-t1 mb-3">
                        Photos ({selectedMediaIds.length} selected)
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsSelectingMedia(true)}
                        className="w-full py-3 rounded-xl border border-dashed border-white/20 hover:border-accent/40 text-sm font-medium text-t2 hover:text-accent transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus size={16} />
                        {selectedMediaIds.length > 0 ? `Change Selected Photos` : 'Select Photos from Library'}
                      </button>
                      <p className="mt-2 text-[11px] text-t3">
                        Add or remove photos from this memory.
                      </p>
                    </div>

                    {selectedMediaIds.length > 0 && (
                      <PhotoReorder
                        photoIds={selectedMediaIds}
                        onReorder={(newOrder) => setSelectedMediaIds(newOrder)}
                      />
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseEditModal}
                    className="px-4 py-2.5 rounded-2xl border border-white/10 text-sm font-medium text-t2 hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleUpdateMemory}
                    className="px-5 py-2.5 rounded-2xl bg-accent text-black text-sm font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform"
                  >
                    Update Memory
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <MediaSelectionModal
        isOpen={isSelectingMedia}
        onClose={() => {
          setIsSelectingMedia(false);
          if (createStep === 1) setCreateStep(0);
        }}
        onConfirm={(ids) => {
          setSelectedMediaIds(ids);
          setIsSelectingMedia(false);
          if (createStep === 1) setCreateStep(2);
        }}
        initialSelectedIds={selectedMediaIds}
      />
      
      {/* State 1: Memories Carousel */}
      <AnimatePresence>
        {!exploredMemoryId && memories.length > 0 && (
          <motion.div 
            key="memories-carousel"
            className="absolute inset-0 flex flex-col items-center justify-center p-4 z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
          >
        
        {/* Carousel Navigation Arrows */}
        {memories.length >= 1 && (
          <>
            <button 
              onClick={handlePrev}
              className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-colors"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <button 
              onClick={handleNext}
              className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-colors"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          </>
        )}

        <div className="w-full max-w-5xl relative">
          <AnimatePresence mode="wait">
            {currentIndex < memories.length ? (
              <motion.div
                key={currentMemory?.id || currentIndex}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.3 }}
                className="relative"
              >
                {currentMemory && (
                  <MemoryEntryCard
                    memory={currentMemory}
                    onExplore={() => setExploredMemoryId(currentMemory.id)}
                    onDelete={() => handleDeleteMemory(currentMemory.id)}
                    onEdit={() => handleEditMemory(currentMemory)}
                  />
                )}
              </motion.div>
            ) : (
              <motion.div
                key="create-slide"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.3 }}
                className="relative flex justify-center"
              >
                <div 
                  onClick={handleOpenCreateModal}
                  className="w-full max-w-md p-12 rounded-[40px] bg-bg-surface border-2 border-dashed border-white/10 hover:border-accent/40 hover:bg-bg-elevated transition-all cursor-pointer group text-center flex flex-col items-center justify-center aspect-[4/5] shadow-2xl"
                >
                  <div className="w-16 h-16 rounded-3xl bg-accent/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Plus className="text-accent w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-bold text-t1 mb-2">Create Another Memory</h3>
                  <p className="text-t3 text-sm max-w-xs">Select photos and create another magic moment.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

            {/* Dots */}
            {memories.length > 0 && (
              <div className="absolute bottom-8 flex gap-2 z-30">
                {[...Array(memories.length + 1)].map((_, idx) => (
                  <button 
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`w-2 h-2 rounded-full transition-colors ${idx === currentIndex ? 'bg-white' : 'bg-white/30'}`}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* State 2: Spatial Canvas (Render over everything when exploring) */}
      <AnimatePresence>
        {exploredMemoryId && (
          <motion.div
            key="spatial-canvas"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 z-50"
          >
            {isMemoryLoading ? (
              <div className="fixed inset-0 bg-[#0f0f0f] z-50 flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-full border-2 border-accent/20 border-t-accent animate-spin mb-4" />
                <p className="text-t2">Loading memory...</p>
              </div>
            ) : layoutItems.length === 0 ? (
              /* Empty state when memory has no photos */
              <div className="fixed inset-0 bg-[#0f0f0f] z-50 flex flex-col items-center justify-center">
                <button 
                  onClick={() => setExploredMemoryId(null)}
                  className="absolute top-6 left-6 z-50 flex items-center gap-2 px-4 py-2 text-white/80 bg-black/40 hover:bg-black/60 hover:text-white rounded-full transition-colors backdrop-blur-md"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                  <span className="font-medium text-sm">Back</span>
                </button>
                <Sparkles className="w-12 h-12 text-accent/40 mb-4" />
                <p className="text-t2 text-lg">This memory has no photos yet.</p>
                <p className="text-t3 text-sm mt-1">The associated media may have been removed.</p>
              </div>
            ) : (
              <MemoryCanvas
                items={layoutItems}
                onClose={() => setExploredMemoryId(null)}
                renderItem={(box, isVisible, isCanvasDragging) => {
                  const item = box as Box & { imgUrl: string, rotation: number, isVideo: boolean };
                  const isHero = item.id === `memory-hero-${exploredMemoryId}`;

                  return (
                    <PhotoCard
                      key={item.id}
                      id={item.id}
                      imgUrl={item.imgUrl}
                      x={item.x}
                      y={item.y}
                      width={item.width}
                      height={item.height}
                      rotation={item.rotation}
                      isVideo={item.isVideo}
                      isVisible={isVisible}
                      layoutId={isHero ? item.id : undefined}
                      onClick={() => {
                        if (isCanvasDragging) return;
                        // Hydrate the global media store with the memory's photos
                        // so FullView's ThumbnailStrip shows the correct filmstrip.
                        setMedia(dummyList);
                        navigate(`/media/${item.id}`);
                      }}
                    />
                  );
                }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Delete Memory"
        description="Are you sure you want to delete this memory? This action cannot be undone."
        confirmText="Delete Memory"
        onConfirm={confirmDeleteMemory}
        onCancel={() => {
          setIsConfirmOpen(false);
          setMemoryToDelete(null);
        }}
        variant="danger"
      />
    </div>
  );
};
