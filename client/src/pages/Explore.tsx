import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { mediaApi } from '../lib/api';
import { useMediaStore } from '../stores/useMediaStore';
import { useNavigate } from 'react-router-dom';
import { HardDrive, Image as ImageIcon, Video, AlertCircle, FileStack } from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { DetailSkeleton } from '../components/ui/Skeletons';

export default function Explore() {
  const { setStats, stats } = useMediaStore();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['library_stats'],
    queryFn: mediaApi.getStats,
  });

  useEffect(() => {
    if (data) {
      setStats(data);
    }
  }, [data, setStats]);

  if (isLoading || !stats) {
    return <DetailSkeleton />;
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Safe mock capacity: assume 50GB total capacity for demo representation
  const TOTAL_CAPACITY = 50 * 1024 * 1024 * 1024; 
  const usedPercentage = Math.min(100, (stats.totalSize / TOTAL_CAPACITY) * 100);

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] mb-2">Explore & Health</h1>
        <p className="text-[var(--text-secondary)]">Review your library composition and manage privacy risks.</p>
      </div>

      {/* Hero: Storage Summary */}
      <div className="mb-8">
        <Card className="bg-[var(--bg-elevated)] border border-[var(--border)] overflow-hidden">
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row gap-8 items-center md:items-start justify-between">
              
              <div className="flex-1 w-full">
                <div className="flex items-center gap-3 mb-2">
                  <div className="rounded-full bg-[var(--accent-green)]/10 p-2 text-[var(--accent-green)]">
                    <HardDrive className="h-6 w-6" />
                  </div>
                  <h2 className="text-xl font-semibold">Storage Used</h2>
                </div>
                <div className="mb-4 flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-[var(--text-primary)]">{formatBytes(stats.totalSize)}</span>
                  <span className="text-sm font-medium text-[var(--text-secondary)]">of 50.0 GB</span>
                </div>

                {/* Progress Bar */}
                <div className="mb-2 h-3 w-full overflow-hidden rounded-full bg-[var(--border)]">
                  <div 
                    className="h-full bg-[var(--accent-green)] rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${usedPercentage}%` }}
                  />
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  {usedPercentage.toFixed(1)}% local storage utilized
                </div>
              </div>

              {/* Quick Stats Grid */}
              <div className="grid grid-cols-2 gap-4 w-full md:w-auto shrink-0 border-t md:border-t-0 md:border-l border-[var(--border)] pt-6 md:pt-0 md:pl-8">
                <div className="flex flex-col gap-1 p-4 rounded-xl bg-[var(--bg-primary)] ring-1 ring-white/5">
                  <ImageIcon className="h-5 w-5 text-blue-400 mb-1" />
                  <span className="text-2xl font-bold">{stats.totalPhotos.toLocaleString()}</span>
                  <span className="text-xs text-[var(--text-secondary)] font-medium uppercase tracking-wider">Photos</span>
                </div>
                <div className="flex flex-col gap-1 p-4 rounded-xl bg-[var(--bg-primary)] ring-1 ring-white/5">
                  <Video className="h-5 w-5 text-purple-400 mb-1" />
                  <span className="text-2xl font-bold">{stats.totalVideos.toLocaleString()}</span>
                  <span className="text-xs text-[var(--text-secondary)] font-medium uppercase tracking-wider">Videos</span>
                </div>
              </div>

            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Health Alerts */}
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Library Health</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        
        {/* Screenshots */}
        <Card 
          className="bg-[var(--bg-elevated)] border-none ring-1 ring-white/5 hover:ring-white/20 transition-all cursor-pointer group"
          onClick={() => navigate('/explore/screenshots')}
        >
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="rounded-full bg-blue-500/10 p-3 text-blue-400 group-hover:scale-110 transition-transform">
                <FileStack className="h-6 w-6" />
              </div>
              <span className="text-xs font-semibold px-2 py-1 bg-[var(--bg-primary)] rounded-full text-[var(--text-secondary)]">Review</span>
            </div>
            <h4 className="font-semibold text-[var(--text-primary)] mb-1">Screenshots</h4>
            <div className="flex items-end justify-between">
              <p className="text-sm text-[var(--text-secondary)]">Cluttering your library</p>
              <span className="text-2xl font-bold text-blue-400">{stats.screenshotCount}</span>
            </div>
          </CardContent>
        </Card>

        {/* Blurry Photos */}
        <Card 
          className="bg-[var(--bg-elevated)] border-none ring-1 ring-white/5 hover:ring-white/20 transition-all cursor-pointer group"
          onClick={() => navigate('/explore/blurry')}
        >
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="rounded-full bg-orange-500/10 p-3 text-orange-400 group-hover:scale-110 transition-transform">
                <AlertCircle className="h-6 w-6" />
              </div>
              <span className="text-xs font-semibold px-2 py-1 bg-[var(--bg-primary)] rounded-full text-[var(--text-secondary)]">Clean up</span>
            </div>
            <h4 className="font-semibold text-[var(--text-primary)] mb-1">Blurry Photos</h4>
            <div className="flex items-end justify-between">
              <p className="text-sm text-[var(--text-secondary)]">Low sharpness detected</p>
              <span className="text-2xl font-bold text-orange-400">{stats.blurryCount}</span>
            </div>
          </CardContent>
        </Card>

        {/* Duplicates */}
        <Card 
          className="bg-[var(--bg-elevated)] border-none ring-1 ring-white/5 hover:ring-white/20 transition-all cursor-pointer group"
          onClick={() => navigate('/explore/duplicates')}
        >
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="rounded-full bg-red-500/10 p-3 text-red-400 group-hover:scale-110 transition-transform">
                <FileStack className="h-6 w-6" />
              </div>
              <span className="text-xs font-semibold px-2 py-1 bg-[var(--bg-primary)] rounded-full text-[var(--text-secondary)]">Manage</span>
            </div>
            <h4 className="font-semibold text-[var(--text-primary)] mb-1">Duplicates</h4>
            <div className="flex items-end justify-between">
              <p className="text-sm text-[var(--text-secondary)]">Exact match hashes</p>
              <span className="text-2xl font-bold text-red-400">{(stats as any).duplicateCount || 0}</span>
            </div>
          </CardContent>
        </Card>

      </div>



      {/* Smart Folders */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Smart Folders</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {['People', 'Documents'].map((category) => (
          <div 
            key={category} 
            className="group cursor-pointer"
            onClick={() => navigate(`/explore/${category.toLowerCase()}`)}
          >
            <div className="aspect-square w-full rounded-2xl bg-[var(--bg-elevated)] ring-1 ring-white/5 overflow-hidden relative mb-2 transition-transform group-hover:scale-[1.03]">
               <div className="absolute inset-0 flex items-center justify-center text-[var(--text-muted)] group-hover:bg-white/5 transition-colors">
                  <span className="text-sm">Folder</span>
               </div>
            </div>
            <span className="text-sm font-medium text-[var(--text-primary)] pl-1">{category}</span>
          </div>
        ))}
        {/* More Coming Soon placeholder */}
        <div className="relative">
          <div className="aspect-square w-full rounded-2xl bg-[var(--bg-elevated)] ring-1 ring-white/5 overflow-hidden relative mb-2 opacity-50">
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
              <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-medium border border-white/20 text-[var(--text-secondary)]">More Coming Soon</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
