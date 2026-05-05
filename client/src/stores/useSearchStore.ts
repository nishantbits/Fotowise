import { create } from 'zustand';
import { searchApi } from '../lib/api';
import type { MediaItem } from '../lib/api';
import { useToastStore } from './useToastStore';

interface SearchState {
  query: string;
  setQuery: (query: string) => void;
  isSearchOverlayOpen: boolean;
  setSearchOverlayOpen: (isOpen: boolean) => void;

  results: MediaItem[];
  isSearching: boolean;
  error: string | null;
  searchType: 'keyword' | 'semantic+keyword' | null;
  performSearch: (query: string) => Promise<void>;
  clearSearch: () => void;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  query: '',
  setQuery: (query) => set({ query }),
  isSearchOverlayOpen: false,
  setSearchOverlayOpen: (isSearchOverlayOpen) => {
    set({ isSearchOverlayOpen });
    if (!isSearchOverlayOpen) {
      get().clearSearch();
    }
  },

  results: [],
  isSearching: false,
  error: null,
  searchType: null,

  performSearch: async (query: string) => {
    if (!query.trim()) {
      set({ results: [], error: null, searchType: null });
      return;
    }

    set({ isSearching: true, error: null });
    try {
      const results = await searchApi.searchMedia(query);
      set({ results, isSearching: false });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Search failed';
      set({ error: errorMsg, isSearching: false, results: [] });
      // Surface a toast so the user knows the search pipeline failed
      useToastStore.getState().addToast(
        `Search failed: ${errorMsg}`,
        'error'
      );
    }
  },

  clearSearch: () => set({ query: '', results: [], error: null, isSearching: false, searchType: null }),
}));
