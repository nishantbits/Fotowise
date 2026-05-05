import axios from 'axios';

// Fotowise Server runs on 3000, Immich runs on 2283
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Types
export interface MediaItem {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  width: number;
  height: number;
  created_at: string;
  imported_at: string;
  blur_score: number;
  is_screenshot: number;
  is_deleted: number;
  is_favorite: number;
  exif_make?: string;
  exif_model?: string;
  /** Only present on search results — cosine similarity score 0–1 */
  semanticScore?: number | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface LibraryStats {
  totalSize: number;
  screenshotCount: number;
  blurryCount: number;
  totalMedia: number;
  totalVideos: number;
  totalPhotos: number;
  peopleClusters?: number;
  recentDocuments?: number;
}

// API Calls
export const mediaApi = {
  getMedia: async (page = 1, limit = 50): Promise<PaginatedResponse<MediaItem>> => {
    const response = await apiClient.get('/media', { params: { page, limit } });
    return response.data;
  },

  getStats: async (): Promise<LibraryStats> => {
    const response = await apiClient.get('/media/stats');
    return response.data;
  },

  deleteMedia: async (id: string): Promise<{ success: boolean; id: string }> => {
    const response = await apiClient.delete(`/media/${id}`);
    return response.data;
  },

  getTrash: async (): Promise<{ data: MediaItem[]; count: number }> => {
    const response = await apiClient.get('/media/trash/list');
    return response.data;
  },

  restoreMedia: async (id: string): Promise<{ success: boolean; id: string }> => {
    const response = await apiClient.post(`/media/${id}/restore`);
    return response.data;
  },

  emptyTrash: async (): Promise<{ success: boolean; deletedCount: number }> => {
    const response = await apiClient.delete('/media/trash/empty');
    return response.data;
  },

  getThumbnailUrl: (id: string, size: '200' | '400' | '800' = '400') => {
    return `${API_BASE_URL}/media/${id}/thumb/${size}`;
  },

  getOriginalUrl: (id: string) => {
    return `${API_BASE_URL}/media/${id}/original`;
  },

  uploadMedia: async (file: File, onProgress?: (progress: number) => void): Promise<MediaItem> => {
    const formData = new FormData();
    formData.append('file', file);
    
    // We can't set Content-Type to application/json for FormData
    const response = await apiClient.post('/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    });
    
    return response.data;
  },

  replaceMedia: async (id: string, file: File): Promise<MediaItem> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await apiClient.put(`/media/${id}/replace`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  }
};

export const searchApi = {
  searchMedia: async (query: string): Promise<MediaItem[]> => {
    const response = await apiClient.get('/search', { params: { q: query } });
    // Backend returns { items: [...], meta: {...} } — unwrap the items array.
    // Each item from search has id/file_name/mime_type etc via the full media join.
    const raw: any[] = response.data?.items ?? response.data ?? [];
    return raw.map((r: any): MediaItem => ({
      id: r.id,
      file_name: r.filename ?? r.file_name ?? '',
      file_path: r.file_path ?? '',
      file_size: r.fileSizeBytes ?? r.file_size ?? 0,
      mime_type: r.mime_type ?? 'image/jpeg',
      width: r.width ?? 0,
      height: r.height ?? 0,
      created_at: r.takenAt ?? r.created_at ?? '',
      imported_at: r.imported_at ?? '',
      blur_score: r.blur_score ?? 0,
      is_screenshot: r.is_screenshot ?? 0,
      is_deleted: r.is_deleted ?? 0,
      is_favorite: r.is_favorite ?? 0,
      exif_make: r.exif_make,
      exif_model: r.exif_model,
    }));
  },

  triggerIndex: async (): Promise<{ message: string; jobId: string | null; total?: number }> => {
    const response = await apiClient.post('/search/index');
    return response.data;
  },
};

/**
 * getAllMedia — fetches every page of the library and returns a flat array.
 * Used by MediaSelectionModal so it shows the full library, not just the
 * first 100 items that happen to be in the Zustand store.
 */
export async function getAllMedia(): Promise<MediaItem[]> {
  const first = await mediaApi.getMedia(1, 200);
  const { totalPages } = first.pagination;
  if (totalPages <= 1) return first.data;

  const restPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) => mediaApi.getMedia(i + 2, 200))
  );
  return [first.data, ...restPages.map(p => p.data)].flat();
}

export const settingsApi = {
  getSettings: async (): Promise<Record<string, string>> => {
    const response = await apiClient.get('/settings');
    return response.data;
  },

  updateSettings: async (settings: Record<string, string>): Promise<{ success: boolean; updated: number }> => {
    const response = await apiClient.put('/settings', settings);
    return response.data;
  },

  getStorageBreakdown: async (): Promise<{ originals: number; thumbnails: number; trash: number; total: number; photoSize: number; videoSize: number }> => {
    const response = await apiClient.get('/settings/storage');
    return response.data;
  },

  exportManifest: async (): Promise<void> => {
    const response = await apiClient.post('/settings/export-manifest', {}, { responseType: 'blob' });
    const blob = new Blob([response.data], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fotowise-manifest-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  clearThumbnails: async (): Promise<{ success: boolean; freedBytes: number }> => {
    const response = await apiClient.post('/settings/clear-thumbnails');
    return response.data;
  },

  rebuildThumbnails: async (): Promise<{ success: boolean; updated: number; total: number }> => {
    const response = await apiClient.post('/settings/rebuild-thumbnails');
    return response.data;
  }
};

export const memoriesApi = {
  getMemories: async (): Promise<{ 
    id: string; 
    title: string; 
    subtitle: string; 
    dateRange: string; 
    photoCount: number; 
    coverPhotos: string[] 
  }[]> => {
    const response = await apiClient.get('/memories');
    return response.data;
  },

  getMemory: async (id: string): Promise<{ 
    id: string; 
    title: string; 
    subtitle: string; 
    dateRange: string; 
    photos: MediaItem[] 
  }> => {
    const response = await apiClient.get(`/memories/${id}`);
    return response.data;
  },

  createMemory: async (data: { 
    title: string; 
    subtitle?: string; 
    dateRange?: string; 
    mediaIds: string[] 
  }): Promise<{ success: boolean; id: string; title: string }> => {
    const response = await apiClient.post('/memories', data);
    return response.data;
  },

  deleteMemory: async (id: string): Promise<{ success: boolean; id: string }> => {
    const response = await apiClient.delete(`/memories/${id}`);
    return response.data;
  },

  updateMemory: async (id: string, data: {
    title: string;
    subtitle?: string;
    dateRange?: string;
    mediaIds: string[];
  }): Promise<{ success: boolean; id: string; title: string }> => {
    const response = await apiClient.put(`/memories/${id}`, data);
    return response.data;
  }
};
