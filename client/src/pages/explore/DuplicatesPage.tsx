import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';
import { useToastStore } from '../../stores/useToastStore';
import { useMediaStore } from '../../stores/useMediaStore';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

interface DuplicateMember {
  id: string;
  thumbnailUrl: string;
  originalUrl: string;
  takenAt: string;
  fileSizeBytes: number;
  width: number;
  height: number;
  isBest: boolean;
}

interface DuplicateGroup {
  groupId: string;
  hash: string;
  copyCount: number;
  sizePerCopy: number;
  totalWastedBytes: number;
  members: DuplicateMember[];
}

interface DuplicatesResponse {
  groups: DuplicateGroup[];
  totalGroups: number;
  totalDuplicates: number;
  totalWastedBytes: number;
}

export default function DuplicatesPage() {
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('size_desc');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const { setMedia } = useMediaStore();

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'info';
  }>({ isOpen: false, title: '', description: '', onConfirm: () => {} });

  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, isOpen: false }));

  const { data, isLoading, isError } = useQuery<DuplicatesResponse>({
    queryKey: ['duplicates', filter, sort],
    queryFn: async () => {
      const res = await apiClient.get('/explore/duplicates', {
        params: { filter, sort }
      });
      return res.data;
    },
    staleTime: 1000 * 60 * 2,
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/explore/duplicates/scan');
      return res.data;
    },
    onSuccess: () => {
      addToast('Finished scanning for duplicates', 'success');
      queryClient.invalidateQueries({ queryKey: ['duplicates'] });
    }
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      const res = await apiClient.delete(`/explore/duplicates/group/${groupId}`);
      return res.data;
    },
    onSuccess: (res) => {
      addToast(`Deleted redundant copies · Freed ${formatBytes(res.freedBytes)}`, 'success');
      queryClient.invalidateQueries({ queryKey: ['duplicates'] });
      queryClient.invalidateQueries({ queryKey: ['library_stats'] });
    },
    onError: (error: any) => {
      const msg = error.response?.data?.error || error.message || 'Unknown error';
      addToast(`Delete failed: ${msg}`, 'error');
    }
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.delete('/explore/duplicates/all');
      return res.data;
    },
    onSuccess: (res) => {
      addToast(`Deleted all redundant copies · Freed ${formatBytes(res.freedBytes)}`, 'success');
      queryClient.invalidateQueries({ queryKey: ['duplicates'] });
      queryClient.invalidateQueries({ queryKey: ['library_stats'] });
    },
    onError: (error: any) => {
      const msg = error.response?.data?.error || error.message || 'Unknown error';
      addToast(`Delete failed: ${msg}`, 'error');
    }
  });

  const setBestMutation = useMutation({
    mutationFn: async ({ groupId, mediaId }: { groupId: string, mediaId: string }) => {
      const res = await apiClient.post('/explore/duplicates/set-best', { groupId, mediaId });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['duplicates'] });
    }
  });

  const handleDeleteGroup = (groupId: string, copyCount: number) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Redundant Copies',
      description: `Delete ${copyCount - 1} redundant copies in this group? This cannot be undone.`,
      variant: 'danger',
      onConfirm: () => {
        closeConfirm();
        deleteGroupMutation.mutate(groupId);
      }
    });
  };

  const handleDeleteAll = () => {
    if (!data || data.totalGroups === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Delete All Copies',
      description: `Delete ${data.totalDuplicates} duplicate files across ${data.totalGroups} groups? This frees ${formatBytes(data.totalWastedBytes)} and cannot be undone.`,
      variant: 'danger',
      onConfirm: () => {
        closeConfirm();
        deleteAllMutation.mutate();
      }
    });
  };

  const handleSetBest = (groupId: string, mediaId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Set Best Copy',
      description: 'Set this copy as the Best Copy? Redundant copies will be deleted when you clean up the group.',
      variant: 'info',
      onConfirm: () => {
        closeConfirm();
        setBestMutation.mutate({ groupId, mediaId });
      }
    });
  };

  if (isLoading) return <div className="p-8 text-[var(--t2)] text-sm">Loading duplicates...</div>;
  if (isError) return <div className="p-8 text-red-400 text-sm">Failed to load duplicates.</div>;

  const stats = data || { totalGroups: 0, totalDuplicates: 0, totalWastedBytes: 0, groups: [] };

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
          <h1 className="text-3xl font-bold tracking-tight text-[var(--t1)] font-syne">Duplicates</h1>
          <span className="px-3 py-1 bg-amber-500/10 text-amber-500 rounded-full text-xs font-bold border border-amber-500/20">
            {stats.totalGroups} groups
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => scanMutation.mutate()} isLoading={scanMutation.isPending}>Rescan Library</Button>
          <Button variant="ghost" onClick={handleDeleteAll} disabled={stats.totalGroups === 0 || deleteAllMutation.isPending}>Keep All Best</Button>
          <Button variant="danger" onClick={handleDeleteAll} disabled={stats.totalGroups === 0 || deleteAllMutation.isPending}>Delete All Copies</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border)]">
          <p className="text-[var(--t2)] text-xs font-medium uppercase tracking-wider mb-1">Groups Found</p>
          <p className="text-2xl font-bold text-[var(--t1)]">{stats.totalGroups}</p>
        </div>
        <div className="bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border)]">
          <p className="text-[var(--t2)] text-xs font-medium uppercase tracking-wider mb-1">Duplicate Files</p>
          <p className="text-2xl font-bold text-[var(--t1)]">{stats.totalDuplicates}</p>
        </div>
        <div className="bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border)]">
          <p className="text-[var(--t2)] text-xs font-medium uppercase tracking-wider mb-1">Space to Free</p>
          <p className="text-2xl font-bold text-[var(--t1)]">{formatBytes(stats.totalWastedBytes)}</p>
        </div>
        <div className="bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border)]">
          <p className="text-[var(--t2)] text-xs font-medium uppercase tracking-wider mb-1">Match Method</p>
          <p className="text-2xl font-bold text-[var(--t1)] font-mono text-sm uppercase tracking-tighter">SHA-256</p>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto py-1 pb-4 mb-4 select-none hide-scrollbar shrink-0">
        {['all', 'two_copies', 'three_plus'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
              filter === f ? 'text-black' : 'bg-[var(--border)] text-[var(--t2)] hover:text-[var(--t1)] hover:bg-[var(--border-hover)]'
            }`}
            style={filter === f ? { backgroundColor: 'var(--accent)' } : {}}
          >
            {f === 'all' ? 'All Groups' : f === 'two_copies' ? '2 Copies' : '3+ Copies'}
          </button>
        ))}
        <div className="w-px h-6 bg-[var(--border)] mx-2"></div>
        {['size_desc', 'date_desc', 'count_desc'].map(s => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
              sort === s ? 'bg-white/10 text-white' : 'bg-transparent border border-[var(--border)] text-[var(--t2)] hover:text-[var(--t1)] hover:bg-white/5'
            }`}
          >
            {s === 'size_desc' ? 'Largest First' : s === 'date_desc' ? 'Newest First' : 'Most Copies'}
          </button>
        ))}
      </div>

      {stats.groups.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-[var(--t2)]">
          <div className="w-24 h-24 mb-6 opacity-20 bg-[var(--bg-elevated)] rounded-full flex items-center justify-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          </div>
          <h2 className="text-xl font-bold text-[var(--t1)] mb-2 font-syne">No duplicates found</h2>
          <p className="text-sm">Your library is clean! We didn't find any exact duplicate files.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6 pb-24">
          {stats.groups.map((group, idx) => (
            <div 
              key={group.groupId}
              className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[18px] p-4 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both"
              style={{ animationDelay: `${idx * 55}ms` }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[var(--t1)] font-bold font-syne text-lg">Group {idx + 1}</h3>
                  <p className="text-[var(--t2)] text-sm">{group.copyCount} copies · {formatBytes(group.sizePerCopy)} each</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteGroup(group.groupId, group.copyCount)}>Keep Best</Button>
                  <Button variant="danger" size="sm" onClick={() => handleDeleteGroup(group.groupId, group.copyCount)}>Delete Copies</Button>
                </div>
              </div>
              <div className="flex gap-2 w-full overflow-x-auto pb-2 snap-x">
                {group.members.map((member) => (
                  <div 
                    key={member.id} 
                    className={`relative aspect-square w-48 min-w-48 overflow-hidden rounded-xl border-2 transition-transform hover:scale-[1.025] cursor-pointer snap-start snap-always ${
                      member.isBest ? 'scale-[1.01]' : 'border-transparent hover:border-white/20'
                    }`}
                    style={member.isBest ? { borderColor: 'var(--accent)' } : {}}
                    onClick={() => {
                      setMedia(group.members as any);
                      navigate(`/media/${member.id}`);
                    }}
                  >
                    <img 
                      src={member.thumbnailUrl} 
                      alt="Duplicate copy" 
                      className="w-full h-full object-cover" 
                      loading="lazy"
                    />
                    {member.isBest && (
                      <div className="absolute top-2 left-2 px-2 py-1 text-black font-bold text-[10px] rounded-md shadow-md z-10" style={{ backgroundColor: 'var(--accent)' }}>
                        BEST
                      </div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 to-transparent pointer-events-none flex justify-between items-end">
                      <div>
                        <p className="text-white text-xs font-medium">{member.width}x{member.height}</p>
                        <p className="text-white/70 text-[10px]">{formatBytes(member.fileSizeBytes)}</p>
                      </div>
                      {!member.isBest && (
                        <button 
                          className="pointer-events-auto px-2 py-1 bg-white/20 hover:bg-white/40 rounded text-[10px] text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetBest(group.groupId, member.id);
                          }}
                        >
                          SET BEST
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.onConfirm}
        onCancel={closeConfirm}
        variant={confirmDialog.variant}
      />
    </div>
  );
}
