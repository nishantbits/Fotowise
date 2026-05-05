import { useState, useMemo, useEffect } from 'react';
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
import { Search, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ScreenshotItem {
  id: string;
  filename: string;
  thumbnailUrl: string;
  originalUrl: string;
  takenAt: string;
  fileSizeBytes: number;
  width: number;
  height: number;
}

interface ScreenshotsResponse {
  items: ScreenshotItem[];
  total: number;
  storageBytes: number;
  oldestDate: string;
  thisMonthCount: number;
  page: number;
  totalPages: number;
}

export default function ScreenshotsPage() {
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const { setMedia } = useMediaStore();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError
  } = useInfiniteQuery<ScreenshotsResponse>({
    queryKey: ['screenshots', filter, debouncedSearch],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await apiClient.get('/explore/screenshots', {
        params: { page: pageParam, limit: 60, filter, q: debouncedSearch }
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

  // Client-side filter for search if backend doesn't support 'q' for screenshots yet
  const displayItems = useMemo(() => {
    if (!debouncedSearch) return allItems;
    const lowerQ = debouncedSearch.toLowerCase();
    return allItems.filter(item => item.filename.toLowerCase().includes(lowerQ));
  }, [allItems, debouncedSearch]);

  const { selectedIds, toggle, selectAll, clearAll, count } = useSelection(displayItems);

  // Stats from the first page
  const stats = data?.pages[0] || { total: 0, storageBytes: 0, oldestDate: new Date().toISOString(), thisMonthCount: 0 };

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
      const res = await apiClient.delete('/explore/screenshots', { data: { ids } });
      return res.data;
    },
    onSuccess: (res) => {
      addToast(`Deleted ${res.deleted} screenshots · Freed ${formatBytes(res.freedBytes)}`, 'success');
      clearAll();
      queryClient.invalidateQueries({ queryKey: ['screenshots'] });
      queryClient.invalidateQueries({ queryKey: ['library_stats'] });
    },
    onError: (error: any) => {
      const msg = error.response?.data?.error || error.message || 'Unknown error';
      addToast(`Delete failed: ${msg}`, 'error');
    }
  });

  const keepMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await apiClient.post('/explore/screenshots/keep', { ids });
      return res.data;
    },
    onSuccess: () => {
      addToast("Marked as kept — they won't appear here again", 'success');
      clearAll();
      queryClient.invalidateQueries({ queryKey: ['screenshots'] });
    }
  });

  const handleDeleteSelected = () => {
    if (count === 0) return;
    setIsConfirmOpen(true);
  };

  const handleKeepAll = () => {
    if (allItems.length === 0) return;
    keepMutation.mutate(allItems.map(i => i.id));
    navigate('/explore');
  };

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'this_month', label: 'This Month' },
    { id: 'large_files', label: 'Large Files' },
  ];

  if (isLoading && !data) {
    return <div className="p-8 text-white">Loading screenshots...</div>;
  }

  if (isError) {
    return <div className="p-8 text-red-400">Failed to load screenshots.</div>;
  }

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
          <h1 className="text-3xl font-bold tracking-tight text-[var(--t1)] font-syne">Screenshots</h1>
          <span className="px-3 py-1 bg-amber-500/10 text-amber-500 rounded-full text-xs font-bold border border-amber-500/20">
            {stats.total} items
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={selectAll}>Select All</Button>
          <Button onClick={handleKeepAll} disabled={allItems.length === 0 || keepMutation.isPending}>Keep All</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border)]">
          <p className="text-[var(--t2)] text-xs font-medium uppercase tracking-wider mb-1">Total Found</p>
          <p className="text-2xl font-bold text-[var(--t1)]">{stats.total}</p>
        </div>
        <div className="bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border)]">
          <p className="text-[var(--t2)] text-xs font-medium uppercase tracking-wider mb-1">Storage Used</p>
          <p className="text-2xl font-bold text-[var(--t1)]">{formatBytes(stats.storageBytes)}</p>
        </div>
        <div className="bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border)]">
          <p className="text-[var(--t2)] text-xs font-medium uppercase tracking-wider mb-1">Oldest</p>
          <p className="text-2xl font-bold text-[var(--t1)]">{formatDate(stats.oldestDate)}</p>
        </div>
        <div className="bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border)]">
          <p className="text-[var(--t2)] text-xs font-medium uppercase tracking-wider mb-1">This Month</p>
          <p className="text-2xl font-bold text-[var(--t1)]">{stats.thisMonthCount}</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
        <div className="flex w-full md:w-auto items-center gap-2 bg-[var(--bg-elevated)] px-3 py-2 rounded-lg border border-[var(--border)] focus-within:border-[var(--accent)] transition-colors">
          <Search size={18} className="text-[var(--t2)]" />
          <input
            type="text"
            placeholder="Search by filename..."
            className="bg-transparent border-none outline-none text-sm w-full md:w-64 text-[var(--t1)] placeholder:text-[var(--t2)]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-hide">
          {filters.map(f => (
            <button
              key={f.id}
              onClick={() => { setFilter(f.id); clearAll(); }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === f.id
                  ? 'bg-[var(--accent)] text-black'
                  : 'bg-[var(--bg-elevated)] text-[var(--t2)] hover:text-[var(--t1)] border border-[var(--border)] hover:border-white/20'
              }`}
            >
              {f.label}
            </button>
          ))}
          <div className="w-px h-6 bg-white/10 mx-2 hidden md:block" />
          <Button
            variant="danger"
            disabled={count === 0}
            onClick={handleDeleteSelected}
            className={`whitespace-nowrap ${count === 0 ? 'opacity-38 pointer-events-none' : ''}`}
          >
            Delete Selected
          </Button>
        </div>
      </div>

      {displayItems.length === 0 ? (
        <ExploreEmptyState
          title="All clean!"
          subtitle="No screenshots found matching your criteria in the library."
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-[10px] pb-24">
          {displayItems.map((item) => (
            <PhotoCard
              key={item.id}
              id={item.id}
              thumbnailUrl={item.thumbnailUrl}
              date={formatDate(item.takenAt)}
              size={formatBytes(item.fileSizeBytes)}
              selected={selectedIds.has(item.id)}
              onToggle={toggle}
              onClick={() => {
                setMedia(displayItems as any);
                navigate(`/media/${item.id}`);
              }}
            />
          ))}
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
        title="Delete Screenshots"
        description={`Are you sure you want to delete ${count} screenshot${count !== 1 ? 's' : ''}? This cannot be undone.`}
        confirmText="Delete Screenshots"
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
