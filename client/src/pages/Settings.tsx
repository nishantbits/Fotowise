import { useEffect, useState } from 'react';
import { useSettingsStore } from '../stores/useSettingsStore';
import { TopBar } from '../components/layout/TopBar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DonutChart } from '../components/ui/DonutChart';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToastStore } from '../stores/useToastStore';
import { Loader2, Palette, Sun, Moon, Monitor, FolderSync, Play, HardDrive, Trash2, Sparkles, Folder, Download, FolderDown, Square, AlertTriangle } from 'lucide-react';
import { FolderPicker } from '../components/ui/FolderPicker';
import { Skeleton } from '../components/ui/Skeleton';
import { mediaApi } from '../lib/api';
import { useJobStore } from '../stores/useJobStore';
import { useUIStore } from '../stores/useUIStore';

export default function Settings() {
  const { storageBreakdown, isLoading, fetchSettings, fetchStorageBreakdown, clearThumbnails, rebuildThumbnails } = useSettingsStore();
  const addToast = useToastStore(s => s.addToast);
  const { jobs } = useJobStore();
  const scanJob = jobs['scan'];
  
  const [watchFolderPath, setWatchFolderPath] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [isStatusLoading, setIsStatusLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isAgentAlive, setIsAgentAlive] = useState(false);
  const [isTriggeringScan, setIsTriggeringScan] = useState(false);

  // Consider it scanning if the job is running OR we just clicked the button
  const isScanning = isTriggeringScan || (scanJob?.status === 'running');

  const [trashCount, setTrashCount] = useState<number | null>(null);
  const [confirmEmptyTrashOpen, setConfirmEmptyTrashOpen] = useState(false);
  const [confirmClearThumbsOpen, setConfirmClearThumbsOpen] = useState(false);
  const [confirmFactoryResetOpen, setConfirmFactoryResetOpen] = useState(false);
  const [isRebuildingThumbs, setIsRebuildingThumbs] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const { accentColor, setAccentColor, theme, setTheme } = useUIStore();

  const themePresets = [
    { name: 'Emerald', color: '#22c982' },
    { name: 'Sapphire', color: '#3b82f6' },
    { name: 'Amethyst', color: '#a855f7' },
    { name: 'Ruby', color: '#f43f5e' },
    { name: 'Amber', color: '#f59e0b' },
  ];

  useEffect(() => {
    fetchSettings();
    fetchStorageBreakdown();

    // Fetch trash count independently
    mediaApi.getTrash().then(res => setTrashCount(res.count)).catch(() => setTrashCount(0));

    // Fetch watcher status from backend — this is the authoritative source of truth.
    // The backend stores the watched folder path in SQLite; active = !!folderPath.
    setIsStatusLoading(true);
    fetch('/api/watcher/status')
      .then(res => res.json())
      .then(data => {
        setIsActive(!!data.active);
        setIsAgentAlive(!!data.agentAlive);
        if (data.folderPath) setWatchFolderPath(data.folderPath);
      })
      .catch(err => console.error('Failed to fetch watcher status', err))
      .finally(() => setIsStatusLoading(false));
  }, [fetchSettings, fetchStorageBreakdown]);

  const handleStartWatching = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/watcher/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: watchFolderPath })
      });
      if (res.ok) {
        setIsActive(true);
        addToast('Started watching folder', 'success');
      } else {
        const err = await res.json();
        addToast(err.error || 'Failed to start watching', 'error');
      }
    } catch (error) {
      addToast('Error starting watcher', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStopWatching = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/watcher/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok) {
        setIsActive(data.active ?? false);
        setWatchFolderPath('');
        addToast('Stopped watching folder', 'success');
      } else {
        addToast(data.error || 'Failed to stop watching', 'error');
      }
    } catch (error) {
      addToast('Error stopping watcher', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateShortcut = async () => {
    try {
      const res = await fetch('/api/watcher/create-shortcut');
      const data = await res.json();
      addToast(data.message || 'Shortcut info retrieved', 'info');
    } catch {
      addToast('Failed to get shortcut instructions', 'error');
    }
  };

  const handleImportExisting = async () => {
    setIsTriggeringScan(true);
    try {
      const res = await fetch('/api/watcher/scan-existing', { method: 'POST' });
      const data = await res.json();
      
      if (res.ok) {
        addToast(
          data.message || 'Scan started',
          data.status === 'agent-error' ? 'error' : 'success'
        );
      } else {
        addToast(data.error || 'Failed to start scan', 'error');
      }
    } catch {
      addToast('Error starting scan', 'error');
    } finally {
      setIsTriggeringScan(false);
    }
  };

  const handleEmptyTrash = async () => {
    try {
      const res = await mediaApi.emptyTrash();
      setTrashCount(0);
      fetchStorageBreakdown();
      addToast(`Permanently deleted ${res.deletedCount} items from trash`, 'success');
    } catch (error) {
      addToast('Failed to empty trash', 'error');
    } finally {
      setConfirmEmptyTrashOpen(false);
    }
  };

  const handleClearThumbnails = async () => {
    try {
      const freedBytes = await clearThumbnails();
      addToast(`Thumbnail cache cleared! Freed ${formatBytes(freedBytes)}.`, 'success');
    } catch (error) {
      addToast('Failed to clear thumbnails', 'error');
    } finally {
      setConfirmClearThumbsOpen(false);
    }
  };

  const handleRebuildThumbnails = async () => {
    setIsRebuildingThumbs(true);
    try {
      addToast('Rebuilding thumbnails in the background...', 'info');
      const { updated, total } = await rebuildThumbnails();
      addToast(`Regenerated thumbnails for ${updated} of ${total} items.`, 'success');
    } catch (error) {
      addToast('Failed to rebuild thumbnails', 'error');
    } finally {
      setIsRebuildingThumbs(false);
    }
  };

  const handleExportManifest = async () => {
    try {
      addToast('Generating library manifest...', 'info');
      const { settingsApi } = await import('../lib/api');
      await settingsApi.exportManifest();
      addToast('Manifest exported successfully', 'success');
    } catch (error) {
      addToast('Failed to export manifest', 'error');
    }
  };

  const handleFactoryReset = async () => {
    setIsResetting(true);
    try {
      addToast('Factory reset in progress...', 'info');
      const res = await fetch('/api/system/reset', { method: 'POST' });
      if (res.ok) {
        addToast('Factory reset successful', 'success');
        window.location.reload();
      } else {
        const data = await res.json();
        addToast(data.error || 'Failed to factory reset', 'error');
      }
    } catch (error) {
      addToast('Failed to execute factory reset', 'error');
    } finally {
      setIsResetting(false);
      setConfirmFactoryResetOpen(false);
    }
  };

  const formatBytes = (bytes: number | null | undefined) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (isLoading && !storageBreakdown) {
    return (
      <div className="flex h-full flex-col">
        <TopBar title="Settings" hideActions />
        <div className="p-6 space-y-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const chartData = storageBreakdown ? [
    { label: 'Original Photos', value: storageBreakdown.photoSize || 0, color: '#3b82f6' }, // blue
    { label: 'Original Videos', value: storageBreakdown.videoSize || 0, color: '#a855f7' }, // purple
    { label: 'Thumbnails', value: storageBreakdown.thumbnails || 0, color: '#4ade80' },     // green
    { label: 'Trash', value: storageBreakdown.trash || 0, color: '#ef4444' },               // red
  ] : [];

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <TopBar title="Settings" hideActions />
      
      <div className="max-w-4xl p-6 mx-auto w-full space-y-8 pb-12">
        
        {/* Theme & Appearance */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Palette className="h-5 w-5 text-[var(--accent)]" />
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">Theme & Appearance</h2>
          </div>
          <Card className="bg-[var(--bg-elevated)] mb-4">
            <CardHeader>
              <CardTitle>App Theme</CardTitle>
              <CardDescription>Choose between Light, Dark, or follow your system setting.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                {([
                  { value: 'light', label: 'Light', Icon: Sun },
                  { value: 'dark',  label: 'Dark',  Icon: Moon },
                  { value: 'system',label: 'System',Icon: Monitor },
                ] as const).map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className="flex-1 flex flex-col items-center gap-2 py-3 px-4 rounded-xl border transition-all duration-200"
                    style={{
                      background: theme === value ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'var(--bg-primary)',
                      borderColor: theme === value ? 'var(--accent)' : 'var(--border)',
                      boxShadow: theme === value ? '0 0 12px color-mix(in srgb, var(--accent) 20%, transparent)' : 'none',
                    }}
                  >
                    <Icon
                      className="h-5 w-5"
                      style={{ color: theme === value ? 'var(--accent)' : 'var(--text-secondary)' }}
                    />
                    <span
                      className="text-xs font-semibold uppercase tracking-wider"
                      style={{ color: theme === value ? 'var(--accent)' : 'var(--text-secondary)' }}
                    >
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[var(--bg-elevated)]">
            <CardHeader>
              <CardTitle>Accent Color</CardTitle>
              <CardDescription>Customize the primary color used across the application.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap gap-4">
                {themePresets.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => setAccentColor(preset.color)}
                    className={`group relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-300 ${
                      accentColor === preset.color 
                        ? 'bg-[var(--accent)]/10 border-[var(--accent)] shadow-[0_0_15px_rgba(34,201,130,0.1)]' 
                        : 'bg-[var(--bg-primary)] border-[var(--border)] hover:border-[var(--accent)]/30'
                    }`}
                  >
                    <div 
                      className="w-10 h-10 rounded-full shadow-lg border border-white/5" 
                      style={{ backgroundColor: preset.color }}
                    />
                    <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      accentColor === preset.color ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'
                    }`}>
                      {preset.name}
                    </span>
                  </button>
                ))}
                
                {/* Custom Color Input */}
                <div className="flex flex-col items-center gap-2 p-3 rounded-xl border bg-[var(--bg-primary)] border-[var(--border)]">
                  <div className="relative">
                    <input 
                      type="color" 
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-10 h-10 rounded-full cursor-pointer absolute inset-0 opacity-0"
                    />
                    <div 
                      className="w-10 h-10 rounded-full border border-white/10 shadow-lg flex items-center justify-center overflow-hidden"
                      style={{ backgroundColor: accentColor }}
                    >
                      <span className="text-white mix-blend-difference font-bold text-xs">+</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Custom</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 flex items-start gap-4">
                <Sparkles className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-200/70 leading-relaxed">
                  The chosen accent color will be applied to buttons, icons, links, and various highlights throughout the interface safely. Changes are saved automatically.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Watch Folders */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <FolderSync className="h-5 w-5" style={{ color: 'var(--accent-green)' }} />
            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Watch Folders</h2>
          </div>
          <Card className="bg-[var(--bg-elevated)]">
            <CardHeader>
              <CardTitle>Auto-Import</CardTitle>
              <CardDescription>Automatically import new photos and videos dropped into a specific folder.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Status Row */}
              <div
                className="flex items-center justify-between p-4 rounded-xl border transition-colors duration-300"
                style={{
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(34,201,130,0.07) 0%, rgba(34,201,130,0.02) 100%)'
                    : 'var(--bg-primary)',
                  borderColor: isActive ? 'rgba(34,201,130,0.25)' : 'var(--border)',
                }}
              >
                <div>
                  <h4 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Status</h4>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Continuously monitor the path for new files</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-3">
                    {isStatusLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gray-600 animate-pulse" />
                        <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Checking…</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div
                          className="relative flex h-3 w-3 items-center justify-center"
                        >
                          {isActive && (
                            <span
                              className="absolute inline-flex h-full w-full rounded-full animate-ping"
                              style={{ backgroundColor: 'rgba(34,201,130,0.4)' }}
                            />
                          )}
                          <span
                            className="relative inline-flex rounded-full h-3 w-3 transition-colors duration-500"
                            style={{
                              backgroundColor: isActive ? '#22c982' : '#4b5563',
                              boxShadow: isActive ? '0 0 10px rgba(34,201,130,0.6)' : 'none',
                            }}
                          />
                        </div>
                        <span
                          className="text-sm font-semibold transition-colors duration-300"
                          style={{ color: isActive ? '#22c982' : 'var(--text-secondary)' }}
                        >
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    )}
                  </div>

                  {!isStatusLoading && (
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-2 pr-1">
                        <div className={`h-1.5 w-1.5 rounded-full ${isAgentAlive ? 'bg-blue-500' : 'bg-red-500'}`} />
                        <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: isAgentAlive ? 'rgb(59, 130, 246)' : 'rgb(239, 68, 68)' }}>
                          Agent: {isAgentAlive ? 'Connected' : 'Disconnected'}
                        </span>
                      </div>
                      {!isAgentAlive && (
                        <span className="text-[9px] text-red-400/60 font-medium text-right">
                          Run <code className="bg-red-500/10 px-1 rounded text-red-300">node watcher-agent.js</code> in the project root to fix.
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Path Picker */}
              <div className="space-y-2">
                <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Library Directory
                </label>
                <div className="relative group">
                  <input
                    type="text"
                    readOnly
                    className="flex h-12 w-full rounded-xl px-4 py-2 text-sm focus:outline-none transition-all duration-200 border border-[var(--border)] pr-32"
                    style={{
                      background: isActive ? 'rgba(34,201,130,0.04)' : 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      opacity: isActive ? 0.7 : 1,
                      cursor: isActive ? 'not-allowed' : 'default',
                    }}
                    placeholder="No folder selected..."
                    value={watchFolderPath}
                  />
                  {!isActive && (
                    <button
                      onClick={() => setIsPickerOpen(true)}
                      className="absolute right-2 top-2 bottom-2 px-4 bg-[var(--accent)] hover:opacity-90 text-white text-xs font-bold rounded-lg shadow-lg transition-all flex items-center gap-2"
                    >
                      <Folder className="w-4 h-4" />
                      Browse
                    </button>
                  )}
                </div>
                {isActive && (
                  <p className="text-xs" style={{ color: 'rgba(34,201,130,0.7)' }}>
                    Stop watching first to change the monitored folder.
                  </p>
                )}
              </div>
              <FolderPicker 
                isOpen={isPickerOpen}
                onClose={() => setIsPickerOpen(false)}
                onSelect={(path) => {
                  setWatchFolderPath(path);
                  setIsPickerOpen(false);
                }}
                initialPath={watchFolderPath}
              />

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap justify-end gap-3">

                {/* Create Desktop Shortcut — always visible, secondary outlined */}
                <button
                  id="watcher-shortcut-btn"
                  onClick={handleCreateShortcut}
                  className="inline-flex items-center justify-center gap-2 rounded-lg h-10 px-4 text-sm font-medium transition-all duration-200 focus-visible:outline-none"
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(239,68,68,0.35)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  Create Desktop Shortcut
                </button>

                {/* Stop — outlined red-tinted; only actionable when active */}
                <button
                  id="watcher-stop-btn"
                  onClick={handleStopWatching}
                  disabled={!isActive || isSaving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg h-10 px-4 text-sm font-medium transition-all duration-200 focus-visible:outline-none disabled:opacity-40 disabled:pointer-events-none"
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(239,68,68,0.35)',
                    color: isActive ? '#f87171' : 'var(--text-muted)',
                  }}
                >
                  <Square className="h-3.5 w-3.5" />
                  {isSaving && isActive ? 'Stopping…' : 'Stop Watching'}
                </button>

                {/* Import Existing — always visible; disabled only when no folder is configured */}
                <button
                  id="watcher-import-btn"
                  onClick={handleImportExisting}
                  disabled={!watchFolderPath || isScanning}
                  title={!watchFolderPath ? 'Configure a folder first' : undefined}
                  className="inline-flex items-center justify-center gap-2 rounded-lg h-10 px-5 text-sm font-semibold transition-all duration-200 focus-visible:outline-none disabled:pointer-events-none"
                  style={{
                    background: !watchFolderPath || isScanning
                      ? 'rgba(34,201,130,0.2)'
                      : 'linear-gradient(135deg, #22c982 0%, #15a368 100%)',
                    color: !watchFolderPath || isScanning ? 'rgba(34,201,130,0.45)' : '#000',
                    boxShadow: !watchFolderPath || isScanning ? 'none' : '0 0 20px rgba(34,201,130,0.3)',
                    cursor: !watchFolderPath || isScanning ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isScanning
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <FolderDown className="h-3.5 w-3.5" />}
                  {isScanning ? 'Scanning…' : 'Import Existing Photos'}
                </button>

                {/* Start — solid bright accent; only actionable when inactive */}
                <button
                  id="watcher-start-btn"
                  onClick={handleStartWatching}
                  disabled={!watchFolderPath || isActive || isSaving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg h-10 px-5 text-sm font-semibold transition-all duration-200 focus-visible:outline-none disabled:pointer-events-none"
                  style={{
                    background: !watchFolderPath || isActive || isSaving
                      ? 'rgba(34,201,130,0.2)'
                      : 'linear-gradient(135deg, #22c982 0%, #15a368 100%)',
                    color: !watchFolderPath || isActive || isSaving ? 'rgba(34,201,130,0.45)' : '#000',
                    boxShadow: !watchFolderPath || isActive || isSaving
                      ? 'none'
                      : '0 0 20px rgba(34,201,130,0.3)',
                    cursor: !watchFolderPath || isActive || isSaving ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Play className="h-3.5 w-3.5" />
                  {isSaving && !isActive ? 'Starting…' : 'Start Watching'}
                </button>
              </div>

            </CardContent>
          </Card>
        </section>

        {/* Storage Management */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <HardDrive className="h-5 w-5 text-blue-400" />
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">Storage Management</h2>
          </div>
          <Card className="bg-[var(--bg-elevated)] relative overflow-hidden">
            <CardContent className="p-6">
              
              <div className="flex flex-col md:flex-row gap-8 items-center">
                {storageBreakdown ? (
                  <DonutChart 
                    data={chartData} 
                    size={220} 
                    strokeWidth={28}
                    centerLabel={formatBytes(storageBreakdown.total)}
                    centerSubLabel="Total Local Usage"
                  />
                ) : (
                  <Skeleton className="h-[220px] w-[220px] rounded-full" />
                )}

                <div className="flex-1 w-full space-y-4">
                  {chartData.map((item) => (
                    <div key={item.label} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-[var(--text-secondary)]">{item.label}</span>
                      </div>
                      <span className="font-medium text-[var(--text-primary)]">{formatBytes(item.value)}</span>
                    </div>
                  ))}
                  
                  <div className="pt-4 mt-4 border-t border-[var(--border)] flex flex-wrap gap-3">
                    <Button variant="secondary" className="text-orange-400 hover:bg-orange-400/10 hover:text-orange-400 border-orange-400/20" onClick={() => setConfirmClearThumbsOpen(true)}>
                      <Sparkles className="h-4 w-4 mr-2" /> Clear Thumbnail Cache
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={isRebuildingThumbs}
                      className="text-[var(--accent-green)] hover:bg-[var(--accent-green)]/10 hover:text-[var(--accent-green)] border-[var(--accent-green)]/20"
                      onClick={handleRebuildThumbnails}
                    >
                      <Sparkles className="h-4 w-4 mr-2" /> {isRebuildingThumbs ? 'Rebuilding…' : 'Rebuild Thumbnails'}
                    </Button>
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>
        </section>

        {/* Danger Zone */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Trash2 className="h-5 w-5 text-red-400" />
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">Data & Trash</h2>
          </div>
          <Card className="bg-red-500/5 border-red-500/20">
            <CardContent className="p-6 space-y-4">
              
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-lg bg-[var(--bg-primary)] border border-red-500/10">
                <div>
                  <h4 className="font-medium text-red-200">Empty Trash</h4>
                  <p className="text-sm text-red-400/70">Permanently delete {trashCount !== null ? trashCount : '...'} items in the trash. This cannot be undone.</p>
                </div>
                <Button 
                  className="bg-red-500 hover:bg-red-600 text-white border-transparent shrink-0" 
                  onClick={() => setConfirmEmptyTrashOpen(true)}
                  disabled={trashCount === 0}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" /> Empty Trash
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)]">
                <div>
                  <h4 className="font-medium text-[var(--text-primary)]">Export Library Manifest</h4>
                  <p className="text-sm text-[var(--text-secondary)]">Download a JSON record of all media, tags, and settings for backup.</p>
                </div>
                <Button variant="secondary" onClick={handleExportManifest} className="shrink-0">
                  <Download className="h-4 w-4 mr-2" /> Export JSON
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-lg bg-red-900/20 border border-red-500/30">
                <div>
                  <h4 className="font-medium text-red-400">Factory Reset</h4>
                  <p className="text-sm text-red-300/70">Wipe all your vault data, metadata, facial recognition models and thumbnails. Your original photo files will NOT be deleted.</p>
                </div>
                <Button 
                  className="bg-red-600 hover:bg-red-700 text-white border-transparent shrink-0" 
                  onClick={() => setConfirmFactoryResetOpen(true)}
                  disabled={isResetting}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" /> {isResetting ? 'Resetting...' : 'Factory Reset'}
                </Button>
              </div>

            </CardContent>
          </Card>
        </section>

      </div>

      <ConfirmDialog
        isOpen={confirmEmptyTrashOpen}
        onCancel={() => setConfirmEmptyTrashOpen(false)}
        onConfirm={handleEmptyTrash}
        title="Empty Trash"
        description="Are you sure you want to permanently delete all items in the trash? The files will be erased from your disk. This action cannot be reversed."
        confirmText="Permanently Delete"
        variant="danger"
      />

      <ConfirmDialog
        isOpen={confirmClearThumbsOpen}
        onCancel={() => setConfirmClearThumbsOpen(false)}
        onConfirm={handleClearThumbnails}
        title="Clear Thumbnail Cache"
        description="This will delete all generated thumbnails to free up space. They will be regenerated automatically (which may take a moment) next time you browse your library."
        confirmText="Clear Cache"
        variant="warning"
      />

      <ConfirmDialog
        isOpen={confirmFactoryResetOpen}
        onCancel={() => setConfirmFactoryResetOpen(false)}
        onConfirm={handleFactoryReset}
        title="Factory Reset"
        description="Are you absolutely sure you want to factory reset? This will wipe all application state, processed metadata, models, and watch folders. Your actual photo files on the hard drive will remain intact, but you will need to start over in the application."
        confirmText="Yes, Factory Reset"
        variant="danger"
      />

    </div>
  );
}
