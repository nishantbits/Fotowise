import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Edit2, Trash2, Info, Heart } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { useMediaStore } from '../stores/useMediaStore';
import { useToastStore } from '../stores/useToastStore';
import { useDeleteMedia } from '../hooks/useDeleteMedia';
import type { MediaItem } from '../lib/api';

import { MediaViewer } from '../components/media/MediaViewer';
import { ThumbnailStrip } from '../components/media/ThumbnailStrip';
import { useEffect, useState } from 'react';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { PhotoEditor } from '../components/editor/PhotoEditor';

export default function FullView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { media, setMedia, updateMedia } = useMediaStore();
  const { addToast } = useToastStore();
  const currentMediaList = media;

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const queryClient = useQueryClient();

  // Shared optimistic-delete hook
  const deleteMutation = useDeleteMedia();

  // ─── Favorite mutation ────────────────────────────────────────────────────
  const favoriteMutation = useMutation({
    mutationFn: (isFavorite: boolean) =>
      apiClient.patch(`/media/${id}/favorite`, { is_favorite: isFavorite }),
    onSuccess: (_, isFavorite) => {
      if (id) updateMedia(id, { is_favorite: isFavorite ? 1 : 0 });
      queryClient.invalidateQueries({ queryKey: ['all-media'] });
    },
    onError: () => {
      addToast('Failed to update favorite', 'error');
    },
  });

  const handleGoBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/', { replace: true });
    }
  };

  // If we arrive here with an empty store (e.g. from Memories spatial canvas),
  // hydrate it from any media list passed via location state.
  useEffect(() => {
    if (currentMediaList.length === 0) {
      const state = location.state as { dummyList?: MediaItem[] } | null;
      if (state?.dummyList && state.dummyList.length > 0) {
        setMedia(state.dummyList);
      }
    }
  }, [currentMediaList.length, location.state, setMedia]);

  const currentIndex = id && currentMediaList.length > 0
    ? currentMediaList.findIndex((m: { id: string }) => m.id === id)
    : -1;

  const activeItem = currentIndex !== -1 ? currentMediaList[currentIndex] : null;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleGoBack();

      if (e.key === 'ArrowRight' && currentIndex < currentMediaList.length - 1) {
        navigate(`/media/${currentMediaList[currentIndex + 1].id}`, { state: location.state, replace: true });
      }
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        navigate(`/media/${currentMediaList[currentIndex - 1].id}`, { state: location.state, replace: true });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, currentMediaList, navigate, location.state]);

  const handleConfirmDelete = () => {
    if (!activeItem) return;
    setIsDeleteDialogOpen(false);

    // Decide where to land after deletion — pick the sibling before navigating
    // because the store still has the full list at this moment.
    const nextId =
      currentMediaList[currentIndex + 1]?.id ||
      currentMediaList[currentIndex - 1]?.id;

    // Navigate synchronously (same tick as the mutation).
    // useDeleteMedia's onMutate also runs synchronously, so by the time React
    // commits the next render the item is already gone from both the
    // InfiniteQuery cache and the Zustand filmstrip store.
    if (currentMediaList.length > 1 && nextId) {
      navigate(`/media/${nextId}`, { replace: true, state: location.state });
    } else {
      handleGoBack();
    }

    // Fire the mutation — onMutate is synchronous, so the optimistic cache
    // update and store removal happen BEFORE the network call.
    deleteMutation.mutate(activeItem.id);
  };

  if (!activeItem) return <div className="flex h-screen w-full items-center justify-center bg-black text-white">Loading...</div>;

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-black text-white">
      {/* Top Bar Overlay */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-6 bg-gradient-to-b from-black/80 to-transparent">
        <button
          onClick={handleGoBack}
          aria-label="Go back"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition-colors hover:bg-[var(--accent-green)] hover:text-black"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex gap-4">
          <button
            aria-label="Toggle favorite"
            onClick={() => favoriteMutation.mutate(!activeItem.is_favorite)}
            disabled={favoriteMutation.isPending}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition-colors hover:text-[var(--accent-green)] disabled:opacity-50"
          >
            <Heart className={`h-5 w-5 ${activeItem.is_favorite ? 'fill-[var(--accent-green)] text-[var(--accent-green)]' : ''}`} />
          </button>

          {activeItem.mime_type?.startsWith('image/') && (
            <button
              aria-label="Edit media"
              onClick={() => setIsEditing(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition-colors hover:text-[var(--accent-green)]"
            >
              <Edit2 className="h-5 w-5" />
            </button>
          )}

          <button
            aria-label="Delete media"
            onClick={() => setIsDeleteDialogOpen(true)}
            disabled={deleteMutation.isPending}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-[var(--danger)] backdrop-blur-md transition-colors hover:bg-[var(--danger)] hover:text-white disabled:opacity-50"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title="Move to Trash"
        description={`Move "${activeItem.file_name}" to the trash? You can restore it from Settings → Trash.`}
        confirmText="Move to Trash"
        cancelText="Cancel"
        variant="danger"
        onCancel={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 relative">
        <MediaViewer item={activeItem} />
      </div>

      {isEditing && (
        <PhotoEditor
          item={activeItem}
          onClose={() => setIsEditing(false)}
        />
      )}

      {/* Right Side Thumbnail Strip */}
      <div className="z-40 w-24 shrink-0 bg-black/80 backdrop-blur-xl border-l border-white/10 sm:w-32">
        <ThumbnailStrip
          media={currentMediaList}
          currentIndex={currentIndex}
          onSelect={(item) => navigate(`/media/${item.id}`, { state: location.state, replace: true })}
        />
      </div>

      {/* Bottom Info Bar Overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-50 p-8 pb-10 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none">
        <div className="flex items-end justify-between pointer-events-auto w-[calc(100%-8rem)]">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2 drop-shadow-md">{activeItem.file_name}</h1>
            <div className="flex items-center gap-4 text-sm text-gray-300 drop-shadow-md">
              <span>{activeItem.created_at ? new Date(activeItem.created_at).toLocaleDateString() : 'Unknown Date'}</span>
              {(activeItem.exif_make || activeItem.exif_model) && (
                <>
                  <span className="h-1 w-1 rounded-full bg-gray-500" />
                  <span>{activeItem.exif_make} {activeItem.exif_model}</span>
                </>
              )}
              {activeItem.file_size && (
                <>
                  <span className="h-1 w-1 rounded-full bg-gray-500" />
                  <span>{(activeItem.file_size / (1024 * 1024)).toFixed(1)} MB</span>
                </>
              )}
            </div>
          </div>
          <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20">
            <Info className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
