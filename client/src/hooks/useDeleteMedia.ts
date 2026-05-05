/**
 * useDeleteMedia — shared hook for optimistic deletion.
 *
 * Strategy (three-layer update):
 *   1. onMutate:   Immediately splice item from the InfiniteQuery cache so
 *                  AllMedia re-renders before the network response arrives.
 *                  Also remove from Zustand store so FullView filmstrip is
 *                  instant. Snapshot old cache for rollback.
 *   2. onError:    Roll back the cache snapshot and re-insert into the store.
 *   3. onSettled:  Invalidate ['all-media'] + ['library_stats'] so background
 *                  refetch reconciles pagination counts with the server.
 */
import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type { MediaItem, PaginatedResponse } from '../lib/api';
import { useMediaStore } from '../stores/useMediaStore';
import { useToastStore } from '../stores/useToastStore';

type InfiniteMediaData = InfiniteData<PaginatedResponse<MediaItem>>;

/** Remove a single id from every page of the InfiniteQuery cache. */
function filterIdFromCache(
  old: InfiniteMediaData | undefined,
  deletedId: string
): InfiniteMediaData | undefined {
  if (!old) return old;
  return {
    ...old,
    pages: old.pages.map(page => ({
      ...page,
      data: page.data.filter(item => item.id !== deletedId),
      pagination: {
        ...page.pagination,
        totalItems: Math.max(0, page.pagination.totalItems - 1),
      },
    })),
  };
}

/** Remove a set of ids from every page of the InfiniteQuery cache. */
function filterIdsFromCache(
  old: InfiniteMediaData | undefined,
  deletedIds: Set<string>
): InfiniteMediaData | undefined {
  if (!old) return old;
  return {
    ...old,
    pages: old.pages.map(page => {
      const removed = page.data.filter(item => deletedIds.has(item.id)).length;
      return {
        ...page,
        data: page.data.filter(item => !deletedIds.has(item.id)),
        pagination: {
          ...page.pagination,
          totalItems: Math.max(0, page.pagination.totalItems - removed),
        },
      };
    }),
  };
}

// ─── Single-item delete ───────────────────────────────────────────────────────

export function useDeleteMedia() {
  const queryClient = useQueryClient();
  const { removeMedia } = useMediaStore();
  const { addToast } = useToastStore();

  return useMutation({
    mutationFn: (mediaId: string) =>
      apiClient.delete(`/media/${mediaId}`).then(r => r.data),

    // Step 1: Optimistic update — runs synchronously before the network call
    onMutate: async (deletedId: string) => {
      // Cancel any in-flight refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['all-media'] });

      // Snapshot the current cache for rollback
      const previousData = queryClient.getQueryData<InfiniteMediaData>(['all-media']);

      // Splice item out of InfiniteQuery cache immediately
      queryClient.setQueryData<InfiniteMediaData>(
        ['all-media'],
        old => filterIdFromCache(old, deletedId)
      );

      // Also remove from Zustand store so FullView filmstrip is instant
      removeMedia(deletedId);

      return { previousData };
    },

    onError: (err: unknown, _deletedId, context) => {
      // Roll back the cache to the pre-mutation snapshot
      if (context?.previousData) {
        queryClient.setQueryData(['all-media'], context.previousData);
      }
      const msg = err instanceof Error ? err.message : 'Delete failed';
      addToast(`Failed to delete: ${msg}`, 'error');
    },

    onSuccess: () => {
      addToast('Moved to trash', 'success');
    },

    // Step 3: Always reconcile with the server in the background
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['all-media'] });
      queryClient.invalidateQueries({ queryKey: ['library_stats'] });
    },
  });
}

// ─── Bulk delete ─────────────────────────────────────────────────────────────

export function useDeleteMediaBulk() {
  const queryClient = useQueryClient();
  const { removeMediaBulk } = useMediaStore();
  const { addToast } = useToastStore();

  return useMutation({
    mutationFn: (ids: string[]) =>
      apiClient.delete('/media', { data: { ids } }).then(r => r.data),

    onMutate: async (deletedIds: string[]) => {
      await queryClient.cancelQueries({ queryKey: ['all-media'] });
      const idSet = new Set(deletedIds);
      const previousData = queryClient.getQueryData<InfiniteMediaData>(['all-media']);

      queryClient.setQueryData<InfiniteMediaData>(
        ['all-media'],
        old => filterIdsFromCache(old, idSet)
      );

      removeMediaBulk(deletedIds);

      return { previousData };
    },

    onError: (err: unknown, _ids, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['all-media'], context.previousData);
      }
      const msg = err instanceof Error ? err.message : 'Delete failed';
      addToast(`Delete failed: ${msg}`, 'error');
    },

    onSuccess: (_, ids) => {
      addToast(`Moved ${ids.length} item${ids.length !== 1 ? 's' : ''} to trash`, 'success');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['all-media'] });
      queryClient.invalidateQueries({ queryKey: ['library_stats'] });
    },
  });
}
