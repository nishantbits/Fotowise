import { useMemo } from 'react';
import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';
import { useSelection } from '../../hooks/useSelection';
import { PhotoCard } from '../../components/explore/PhotoCard';
import { FloatingActionBar } from '../../components/explore/FloatingActionBar';
import { ExploreEmptyState } from '../../components/explore/ExploreEmptyState';
import { useToastStore } from '../../stores/useToastStore';
import { useMediaStore } from '../../stores/useMediaStore';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BlurryItem {
  id: string;
  filename: string;
  thumbnailUrl: string;
  originalUrl: string;
  takenAt: string;
  fileSizeBytes: number;
  width: number;
  height: number;
  sharpnessScore: number;
}

interface BlurryResponse {
  items: BlurryItem[];
  total: number;
  storageBytes: number;
  distribution: {
    severe: number;
    moderate: number;
    slight: number;
  };
  page: number;
  totalPages: number;
}

export default function BlurryPhotosPage() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const navigate = useNavigate();
  const { setMedia } = useMediaStore();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError
  } = useInfiniteQuery<BlurryResponse>({
    queryKey: ['blurry'],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await apiClient.get('/explore/blurry', {
        params: { page: pageParam, limit: 60 }
      });
      return res.data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    staleTime: 1000 * 60 * 2,
  });

  const allItems = useMemo(() => {
    return data?.pages.flatMap(page => page.items) || [];
  }, [data]);

  const { selectedIds, toggle, selectAll, clearAll, count } = useSelection(allItems);

  // Stats from the first page
  const stats = data?.pages[0] || { total: 0, storageBytes: 0, distribution: { severe: 0, moderate: 0, slight: 0 } };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await apiClient.delete('/explore/blurry', { data: { ids } });
      return res.data;
    },
    onSuccess: (res) => {
      addToast(`Deleted ${res.deleted} blurry photos · Freed ${formatBytes(res.freedBytes)}`, 'success');
      clearAll();
      queryClient.invalidateQueries({ queryKey: ['blurry'] });
      queryClient.invalidateQueries({ queryKey: ['library_stats'] });
    },
    onError: (error: any) => {
      const msg = error.response?.data?.error || error.message || 'Unknown error';
      addToast(`Delete failed: ${msg}`, 'error');
    }
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/explore/blurry/analyze');
      return res.data;
    },
    onSuccess: (res) => {
      addToast(`Analyzed sharpness for ${res.count} items`, 'success');
      queryClient.invalidateQueries({ queryKey: ['blurry'] });
    }
  });

  const handleDeleteSelected = () => {
    if (count === 0) return;
    setIsConfirmOpen(true);
  };

  const getSeverityBadge = (score: number): { label: string, variant: 'danger' | 'amber' | 'success' } => {
    if (score < 10) return { label: `Severe (${score.toFixed(0)})`, variant: 'danger' };
    if (score < 20) return { label: `Moderate (${score.toFixed(0)})`, variant: 'amber' };
    return { label: `Slight (${score.toFixed(0)})`, variant: 'success' };
  };

  if (isLoading && !data) {
    return <div className="p-8 text-white">Loading blurry photos...</div>;
  }

  if (isError) {
    return <div className="p-8 text-red-400">Failed to load blurry photos.</div>;
  }

  const totalDist = stats.distribution.severe + stats.distribution.moderate + stats.distribution.slight;
  const severePct = totalDist ? (stats.distribution.severe / totalDist) * 100 : 0;
  const moderatePct = totalDist ? (stats.distribution.moderate / totalDist) * 100 : 0;
  const slightPct = totalDist ? (stats.distribution.slight / totalDist) * 100 : 0;

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 md:p-8 relative">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/explore')}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-[var(--t2)] hover:text-[var(--t1)] transition-colors"
            title="Back to Explore"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--t1)] font-syne">Blurry Photos</h1>
          <span className="px-3 py-1 bg-red-500/10 text-red-500 rounded-full text-xs font-bold border border-red-500/20">
            {stats.total} items
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => analyzeMutation.mutate()} isLoading={analyzeMutation.isPending}>Run Analyzer</Button>
          <Button variant="ghost" onClick={selectAll}>Select All</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-[var(--bg-elevated)] p-6 rounded-xl border border-[var(--border)] flex flex-col justify-between">
          <div>
            <p className="text-[var(--t2)] text-xs font-medium uppercase tracking-wider mb-1">Total Wasted Storage</p>
            <p className="text-3xl font-bold text-[var(--t1)]">{formatBytes(stats.storageBytes)}</p>
          </div>
          <div className="mt-4">
            <Button variant="danger" className="w-full" disabled={count === 0} onClick={handleDeleteSelected}>
              Delete Selected
            </Button>
          </div>
        </div>

        <div className="bg-[var(--bg-elevated)] p-6 rounded-xl border border-[var(--border)]">
          <p className="text-[var(--t2)] text-xs font-medium uppercase tracking-wider mb-4">Blur Distribution</p>
          
          <div className="flex w-full h-4 rounded-full overflow-hidden mb-4 bg-[var(--border)]">
            <div style={{ width: `${severePct}%` }} className="bg-red-500 transition-all" />
            <div style={{ width: `${moderatePct}%` }} className="bg-orange-500 transition-all" />
            <div style={{ width: `${slightPct}%` }} className="bg-yellow-500 transition-all" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm font-medium">Severe</span>
              </div>
              <span className="text-2xl font-bold">{stats.distribution.severe}</span>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-sm font-medium">Moderate</span>
              </div>
              <span className="text-2xl font-bold">{stats.distribution.moderate}</span>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-sm font-medium">Slight</span>
              </div>
              <span className="text-2xl font-bold">{stats.distribution.slight}</span>
            </div>
          </div>
        </div>
      </div>

      {allItems.length === 0 ? (
        <ExploreEmptyState
          title="Crystal clear!"
          subtitle="No blurry photos were found in your library."
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-[10px] pb-24">
          {allItems.map((item) => {
            const badge = getSeverityBadge(item.sharpnessScore);
            return (
              <PhotoCard
                key={item.id}
                id={item.id}
                thumbnailUrl={item.thumbnailUrl}
                date={formatDate(item.takenAt)}
                size={formatBytes(item.fileSizeBytes)}
                selected={selectedIds.has(item.id)}
                badge={badge}
                onToggle={toggle}
                onClick={() => {
                  setMedia(allItems as any);
                  navigate(`/media/${item.id}`);
                }}
              />
            );
          })}
        </div>
      )}

      {hasNextPage && (
        <div className="flex justify-center mt-8 mb-24">
          <Button variant="secondary" onClick={() => fetchNextPage()} isLoading={isFetchingNextPage}>
            Load More
          </Button>
        </div>
      )}

      <FloatingActionBar
        count={count}
        onDeselect={clearAll}
        onDelete={handleDeleteSelected}
        isDeleting={deleteMutation.isPending}
      />

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Delete Blurry Photos"
        description={`Are you sure you want to delete ${count} blurry photo${count !== 1 ? 's' : ''}? This cannot be undone.`}
        confirmText="Delete Photos"
        onConfirm={() => {
          setIsConfirmOpen(false);
          deleteMutation.mutate(Array.from(selectedIds));
        }}
        onCancel={() => setIsConfirmOpen(false)}
        variant="danger"
      />
    </div>
  );
}
