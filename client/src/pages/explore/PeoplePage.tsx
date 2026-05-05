import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';
import { useToastStore } from '../../stores/useToastStore';
import { ArrowLeft, Search, RefreshCw } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { RadialScrollGallery } from '../../components/ui/RadialScrollGallery';
import { Button } from '../../components/ui/Button';

// Mock color palette seeded by cluster ID hash
const CLUSTER_COLORS = ['#22c982', '#5590f0', '#e8a228', '#d870a0', '#a07850', '#70a0d0'];
function getColorForCluster(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return CLUSTER_COLORS[Math.abs(hash) % CLUSTER_COLORS.length];
}

interface Cluster {
  id: string;
  name: string | null;
  coverThumbnailUrl: string | null;
  photoCount: number;
  isNamed: boolean;
  recentThumbnails: string[];
}

interface PeopleResponse {
  clusters: Cluster[];
  totalClusters: number;
  namedCount: number;
  unnamedCount: number;
  totalTaggedPhotos: number;
}

export default function PeoplePage() {
  const [filter, setFilter] = useState<'all' | 'named' | 'unnamed'>('all');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const { data, isLoading, isError } = useQuery<PeopleResponse>({
    queryKey: ['people'],
    queryFn: async () => {
      const res = await apiClient.get('/explore/people');
      return res.data.data;
    },
    staleTime: 1000 * 60 * 2,
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string, name: string }) => {
      const res = await apiClient.patch(`/explore/people/${id}`, { name });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      addToast('Name saved', 'success');
      setEditingId(null);
    },
    onError: (error: any) => {
      addToast(error.response?.data?.error || error.message, 'error');
    }
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/explore/people/analyze');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      addToast('Finished scanning library for people', 'success');
    }
  });

  const handleSaveName = (id: string) => {
    if (!editName.trim()) {
      setEditingId(null);
      return;
    }
    renameMutation.mutate({ id, name: editName });
  };

  const startRename = (c: Cluster) => {
    setEditName(c.name || '');
    setEditingId(c.id);
  };

  if (isLoading) return <div className="p-8 text-[var(--t2)] text-sm">Loading people...</div>;
  if (isError) return <div className="p-8 text-red-400 text-sm">Failed to load people.</div>;

  const stats = data || { clusters: [], totalClusters: 0, namedCount: 0, unnamedCount: 0, totalTaggedPhotos: 0 };

  const filteredClusters = stats.clusters.filter(c => {
    if (filter === 'named' && !c.isNamed) return false;
    if (filter === 'unnamed' && c.isNamed) return false;
    if (search && c.name && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Sort unnamed to the bottom naturally is already handled by DB usually, or we can explicit sort here
  filteredClusters.sort((a, b) => {
    if (a.isNamed && !b.isNamed) return -1;
    if (!a.isNamed && b.isNamed) return 1;
    return 0;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[var(--bg-primary)]">
      <div className="p-4 md:p-8 pb-0 shrink-0">
        <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/explore')}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-[var(--t2)] hover:text-[var(--t1)] transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--t1)] font-syne">People</h1>
          <span className="px-3 py-1 bg-[var(--accent-green)]/10 text-[var(--accent-green)] rounded-full text-xs font-bold border border-[var(--accent-green)]/20">
            {stats.totalClusters} clusters
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => scanMutation.mutate()} isLoading={scanMutation.isPending}>
            <RefreshCw size={14} className="mr-2" />
            Rescan Library
          </Button>
          <Button variant="ghost" disabled>Merge Clusters</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border)]">
          <p className="text-[var(--t2)] text-xs font-medium uppercase tracking-wider mb-1">People Found</p>
          <p className="text-2xl font-bold text-[var(--t1)]">{stats.totalClusters}</p>
        </div>
        <div className="bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border)]">
          <p className="text-[var(--t2)] text-xs font-medium uppercase tracking-wider mb-1">Named</p>
          <p className="text-2xl font-bold text-[var(--t1)]">{stats.namedCount}</p>
        </div>
        <div className="bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border)]">
          <p className="text-[var(--t2)] text-xs font-medium uppercase tracking-wider mb-1">Unidentified</p>
          <p className="text-2xl font-bold text-[var(--t1)]">{stats.unnamedCount}</p>
        </div>
        <div className="bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border)]">
          <p className="text-[var(--t2)] text-xs font-medium uppercase tracking-wider mb-1">Tagged Photos</p>
          <p className="text-2xl font-bold text-[var(--t1)]">{stats.totalTaggedPhotos}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-8">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--t2)]" />
          <input
            type="text"
            placeholder="Search people..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-full py-2 pl-9 pr-4 text-sm text-[var(--t1)] outline-none focus:border-[var(--accent-green)]/50 transition-colors"
          />
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
          {['all', 'named', 'unnamed'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                filter === f ? 'bg-[var(--accent-green)] text-black' : 'bg-[var(--border)] text-[var(--t2)] hover:text-[var(--t1)] hover:bg-[var(--border-hover)]'
              }`}
            >
              {f === 'all' ? 'All' : f === 'named' ? 'Named' : 'Unidentified'}
            </button>
          ))}
        </div>
        </div>
      </div>

      <div id="people-scroll-container" className="flex-1 overflow-y-auto min-h-0 relative custom-scrollbar">
        <div className="min-h-[300vh] relative">
          <div className="sticky top-0 h-screen flex flex-col justify-center py-16">
            <RadialScrollGallery 
              scroller="#people-scroll-container" 
              className="w-full" 
              scrollDuration={Math.max(filteredClusters.length * 200, 1000)}
            >
        {(_hoveredIndex) => filteredClusters.map((cluster) => {
          const color = getColorForCluster(cluster.id);
          const isEditing = editingId === cluster.id;
          
          if (isEditing) {
            return (
              <div 
                key={cluster.id}
                className="w-56 h-72 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[18px] p-4 flex flex-col items-center justify-center text-center shadow-2xl relative z-50"
              >
                <div className="w-full flex flex-col gap-2 relative z-10">
                  <input
                    autoFocus
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-2 text-base text-center outline-none focus:border-[var(--accent-green)]"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveName(cluster.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                  <div className="flex gap-2 w-full mt-2">
                    <Button variant="ghost" size="sm" className="flex-1" onClick={() => setEditingId(null)}>Cancel</Button>
                    <Button variant="primary" size="sm" className="flex-1" onClick={() => handleSaveName(cluster.id)}>Save</Button>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <Link 
              key={cluster.id}
              to={`/explore/people/${cluster.id}`}
              className="block w-56 h-72 bg-[var(--bg-elevated)] border border-[var(--border)] hover:border-white/10 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 rounded-[24px] p-6 flex flex-col items-center justify-center text-center group"
            >
              <div 
                className="w-28 h-28 rounded-full mb-6 flex items-center justify-center relative p-1 shadow-inner"
                style={{ 
                  background: cluster.isNamed ? `conic-gradient(from 0deg, ${color} 0%, transparent 80%, ${color} 100%)` : 'var(--border)',
                  animation: cluster.isNamed ? 'spin 10s linear infinite' : 'none'
                }}
              >
                <div className="w-full h-full rounded-full overflow-hidden bg-[var(--bg-primary)] flex items-center justify-center absolute inset-[2px]">
                   {cluster.coverThumbnailUrl ? (
                     <img src={cluster.coverThumbnailUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy" />
                   ) : (
                     <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
                       <span style={{ color }} className="font-syne font-bold text-4xl">
                         {cluster.isNamed ? cluster.name![0].toUpperCase() : '?'}
                       </span>
                     </div>
                   )}
                </div>
              </div>
              
              <h3 className={`font-syne font-bold text-xl truncate w-full mb-1 ${cluster.isNamed ? 'text-[var(--t1)]' : 'text-[var(--t2)]'}`}>
                {cluster.name || 'Unnamed Person'}
              </h3>
              <p className="text-sm text-[var(--text-secondary)] font-medium bg-[var(--bg-primary)] px-3 py-1 rounded-full mb-2">{cluster.photoCount} photos</p>
              {!cluster.isNamed && (
                <button 
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); startRename(cluster); }}
                  className="mt-2 w-full py-2 bg-[var(--accent-green)]/10 text-[var(--accent-green)] hover:bg-[var(--accent-green)]/20 transition-colors rounded-lg font-medium text-sm"
                >
                  Add Name
                </button>
              )}
            </Link>
          );
        })}
            </RadialScrollGallery>
          </div>
        </div>
{/* Add global style for the spin animation on hover but keep it infinite for named people avatars */}
<style>{`
  @keyframes spin { 100% { transform: rotate(360deg); } }
`}</style>
      </div>
    </div>
  );
}
