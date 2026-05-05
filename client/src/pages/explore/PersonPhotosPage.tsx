import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';
import { useToastStore } from '../../stores/useToastStore';
import { useMediaStore } from '../../stores/useMediaStore';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { PhotoCard } from '../../components/explore/PhotoCard';
import { FloatingActionBar } from '../../components/explore/FloatingActionBar';
import { useSelection } from '../../hooks/useSelection';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';

import type { MediaItem } from '../../lib/api';

interface PersonPhotosResponse {
  clusterName: string | null;
  items: MediaItem[];
  total: number;
  page: number;
  totalPages: number;
}

export default function PersonPhotosPage() {
  const { clusterId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const { setMedia } = useMediaStore();
  const page = 1;
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isMergeOpen, setIsMergeOpen] = useState(false);

  const { data: peopleData } = useQuery({
    queryKey: ['people'],
    queryFn: async () => {
      const res = await apiClient.get('/explore/people');
      return res.data;
    },
    enabled: isMergeOpen
  });

  const mergeMutation = useMutation({
    mutationFn: async (targetId: string) => {
      const res = await apiClient.post('/explore/people/merge', {
        sourceId: clusterId,
        targetId
      });
      return res.data;
    },
    onSuccess: () => {
      addToast('Person merged successfully', 'success');
      queryClient.invalidateQueries({ queryKey: ['people'] });
      navigate('/explore/people');
    },
    onError: (error: any) => {
      addToast(error.response?.data?.error || error.message, 'error');
    }
  });

  const { data, isLoading, isError } = useQuery<PersonPhotosResponse>({
    queryKey: ['person-photos', clusterId, page],
    queryFn: async () => {
      const res = await apiClient.get(`/explore/people/${clusterId}/photos`, {
        params: { page, limit: 60 }
      });
      return res.data;
    },
    staleTime: 1000 * 60 * 2,
    enabled: !!clusterId
  });

  const { selectedIds, toggle, clearAll, count } = useSelection(data?.items || []);

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await apiClient.delete('/media', { data: { ids } }); // standard bulk delete
      return res.data;
    },
    onSuccess: () => {
      addToast(`Deleted ${count} photos`, 'success');
      clearAll();
      queryClient.invalidateQueries({ queryKey: ['person-photos'] });
      queryClient.invalidateQueries({ queryKey: ['people'] });
      queryClient.invalidateQueries({ queryKey: ['library_stats'] });
    },
    onError: (error: any) => {
      addToast(error.response?.data?.error || error.message, 'error');
    }
  });

  const handleDelete = () => {
    if (count === 0) return;
    setIsConfirmOpen(true);
  };

  if (isLoading) return <div className="p-8 text-[var(--t2)] text-sm">Loading photos...</div>;
  if (isError) return <div className="p-8 text-red-400 text-sm">Failed to load photos.</div>;

  const items = data?.items || [];
  const name = data?.clusterName || 'Unnamed Person';

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 md:p-8 relative">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/explore/people')}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-[var(--t2)] hover:text-[var(--t1)] transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--t1)] font-syne">{name}</h1>
          <span className="px-3 py-1 bg-[var(--accent-green)]/10 text-[var(--accent-green)] rounded-full text-xs font-bold border border-[var(--accent-green)]/20">
            {data?.total || 0} photos
          </span>
        </div>
        <div>
          <Button variant="ghost" size="sm" onClick={() => setIsMergeOpen(true)} className="text-[var(--text-secondary)] hidden sm:flex">
            Merge Person
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-[var(--t2)]">
          <p>No photos found for this person.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3 pb-24">
          {items.map((item: any) => (
            <PhotoCard
              key={item.id}
              id={item.id}
              thumbnailUrl={item.thumbnailUrl}
              date={item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
              size={item.file_size ? (item.file_size / 1024 / 1024).toFixed(1) + ' MB' : ''}
              selected={selectedIds.has(item.id)}
              onToggle={toggle}
              onClick={() => {
                setMedia(items);
                navigate(`/media/${item.id}`);
              }}
            />
          ))}
        </div>
      )}

      <FloatingActionBar 
        count={count}
        onDeselect={clearAll}
        onDelete={handleDelete}
        isDeleting={deleteMutation.isPending}
      />

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Delete Photos"
        description={`Are you sure you want to delete ${count} photo${count !== 1 ? 's' : ''}? This cannot be undone.`}
        confirmText="Delete Photos"
        onConfirm={() => {
          setIsConfirmOpen(false);
          deleteMutation.mutate(Array.from(selectedIds));
        }}
        onCancel={() => setIsConfirmOpen(false)}
        variant="danger"
      />

      <Modal isOpen={isMergeOpen} onClose={() => setIsMergeOpen(false)} title="Merge Person">
        <p className="mb-4 text-sm text-[var(--text-secondary)]">
          Select another person from your library to merge this cluster into. 
          All photos from here will be moved to the selected person.
        </p>
        
        <div className="max-h-[300px] overflow-y-auto space-y-2 mb-4">
          {peopleData?.data?.clusters?.filter((c: any) => c.id !== clusterId && c.name).map((person: any) => (
            <button
              key={person.id}
              onClick={() => {
                if(window.confirm(`Merge into ${person.name}?`)) {
                  mergeMutation.mutate(person.id);
                  setIsMergeOpen(false);
                }
              }}
              className="w-full flex items-center justify-between p-3 rounded-lg border border-[var(--border)] hover:border-[var(--accent-green)] hover:bg-[var(--accent-green)]/5 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-[var(--bg-elevated)] border border-[var(--border)]">
                   {person.coverThumbnailUrl && <img src={person.coverThumbnailUrl} className="w-full h-full object-cover" />}
                </div>
                <span className="font-semibold text-sm text-[var(--text-primary)]">{person.name}</span>
              </div>
              <span className="text-xs text-[var(--text-secondary)]">{person.photoCount} photos</span>
            </button>
          ))}
          {peopleData?.data?.clusters?.filter((c: any) => c.id !== clusterId && c.name).length === 0 && (
            <div className="p-4 text-center text-sm text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-lg">No other named people found.</div>
          )}
        </div>
        <div className="flex justify-end mt-6 border-t border-[var(--border)] pt-4">
          <Button variant="ghost" onClick={() => setIsMergeOpen(false)}>Cancel</Button>
        </div>
      </Modal>
    </div>
  );
}
