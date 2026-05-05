import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'dark' | 'light' | 'system';

interface UIState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
  uploadModalOpen: boolean;
  setUploadModalOpen: (isOpen: boolean) => void;
  accentColor: string;
  setAccentColor: (color: string) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      uploadModalOpen: false,
      setUploadModalOpen: (uploadModalOpen) => set({ uploadModalOpen }),
      accentColor: '#22c982',
      setAccentColor: (accentColor) => set({ accentColor }),
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'fotowise-ui-storage',
    }
  )
);
