import { create } from 'zustand';
import type { MediaItem, LibraryStats } from '../lib/api';

interface MediaState {
  media: MediaItem[];
  setMedia: (media: MediaItem[]) => void;
  appendMedia: (media: MediaItem[]) => void;
  prependMedia: (item: MediaItem) => void;
  updateMedia: (id: string, updates: Partial<MediaItem>) => void;
  /** Atomically remove a single item from the store */
  removeMedia: (id: string) => void;
  /** Atomically remove multiple items from the store in one update */
  removeMediaBulk: (ids: string[]) => void;
  stats: LibraryStats | null;
  setStats: (stats: LibraryStats) => void;
}

export const useMediaStore = create<MediaState>((set) => ({
  media: [],
  setMedia: (media) => set({ media }),
  appendMedia: (newMedia) => set((state) => ({ media: [...state.media, ...newMedia] })),
  prependMedia: (item) => set((state) => ({ media: [item, ...state.media] })),
  updateMedia: (id, updates) => set((state) => ({
    media: state.media.map(m => m.id === id ? { ...m, ...updates } : m)
  })),
  removeMedia: (id) => set((state) => ({
    media: state.media.filter(m => m.id !== id)
  })),
  removeMediaBulk: (ids) => {
    const idSet = new Set(ids);
    set((state) => ({ media: state.media.filter(m => !idSet.has(m.id)) }));
  },
  stats: null,
  setStats: (stats) => set({ stats }),
}));
