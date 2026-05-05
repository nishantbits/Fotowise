import { create } from 'zustand';
import { settingsApi } from '../lib/api';

interface StorageBreakdown {
  originals: number;
  thumbnails: number;
  trash: number;
  total: number;
  photoSize: number;
  videoSize: number;
}

interface SettingsState {
  settings: Record<string, string>;
  storageBreakdown: StorageBreakdown | null;
  isLoading: boolean;
  
  fetchSettings: () => Promise<void>;
  updateSettings: (newSettings: Record<string, string>) => Promise<void>;
  fetchStorageBreakdown: () => Promise<void>;
  clearThumbnails: () => Promise<number>;
  rebuildThumbnails: () => Promise<{ updated: number; total: number }>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {},
  storageBreakdown: null,
  isLoading: false,

  fetchSettings: async () => {
    set({ isLoading: true });
    try {
      const settings = await settingsApi.getSettings();
      set({ settings, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      set({ isLoading: false });
    }
  },

  updateSettings: async (newSettings) => {
    try {
      await settingsApi.updateSettings(newSettings);
      set((state) => ({ settings: { ...state.settings, ...newSettings } }));
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  },

  fetchStorageBreakdown: async () => {
    try {
      const breakdown = await settingsApi.getStorageBreakdown();
      set({ storageBreakdown: breakdown });
    } catch (error) {
      console.error('Failed to fetch storage breakdown:', error);
    }
  },

  clearThumbnails: async () => {
    try {
      const result = await settingsApi.clearThumbnails();
      await get().fetchStorageBreakdown(); // Refresh breakdown
      return result.freedBytes;
    } catch (error) {
      console.error('Failed to clear thumbnails:', error);
      throw error;
    }
  },

  rebuildThumbnails: async () => {
    try {
      const result = await settingsApi.rebuildThumbnails();
      await get().fetchStorageBreakdown();
      return { updated: result.updated, total: result.total };
    } catch (error) {
      console.error('Failed to rebuild thumbnails:', error);
      throw error;
    }
  }
}));
