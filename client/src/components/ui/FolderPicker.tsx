import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Folder, ChevronRight, HardDrive, ArrowLeft, X, Check } from 'lucide-react';

interface Directory {
  name: string;
  path: string;
}

interface FolderPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  initialPath?: string;
}

export function FolderPicker({ isOpen, onClose, onSelect, initialPath = '' }: FolderPickerProps) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [directories, setDirectories] = useState<Directory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDirectories = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/watcher/directories?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setDirectories(data.directories || []);
      setCurrentPath(data.currentPath || path);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDirectories(currentPath);
    }
  }, [isOpen]);

  const handleNavigate = (path: string) => {
    fetchDirectories(path);
  };

  const handleGoBack = () => {
    const parts = currentPath.split(/[\\/]/).filter(Boolean);
    if (parts.length <= 1) {
      fetchDirectories(''); // Go to root/drives
    } else {
      parts.pop();
      const parent = currentPath.startsWith('/') 
        ? '/' + parts.join('/') 
        : parts.join('\\');
      fetchDirectories(parent);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-2xl bg-[#0F172A] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <Folder className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Select Folder</h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-[400px]">
                {currentPath || 'Computer'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
          {currentPath && (
            <button
              onClick={handleGoBack}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800/50 text-slate-400 transition-all group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-medium">.. (Parent Directory)</span>
            </button>
          )}

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-500 animate-pulse">Scanning filesystem...</p>
            </div>
          ) : error ? (
            <div className="py-20 text-center space-y-4">
              <p className="text-red-400 text-sm">{error}</p>
              <button 
                onClick={() => fetchDirectories(currentPath)}
                className="text-cyan-400 text-xs hover:underline"
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-1">
              {directories.map((dir) => (
                <button
                  key={dir.path}
                  onClick={() => handleNavigate(dir.path)}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-800/80 text-slate-300 transition-all group border border-transparent hover:border-slate-700/50"
                >
                  <div className="flex items-center gap-3">
                    {dir.path.length <= 3 ? <HardDrive className="w-4 h-4 text-slate-500" /> : <Folder className="w-4 h-4 text-cyan-500/60" />}
                    <span className="text-sm font-medium group-hover:text-white transition-colors">{dir.name}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                </button>
              ))}
              {directories.length === 0 && (
                <div className="py-20 text-center">
                  <p className="text-slate-500 text-sm italic">No subdirectories found.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-900/80 border-t border-slate-800 flex justify-between items-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold px-2">
            Click a folder to enter
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onSelect(currentPath)}
              disabled={!currentPath || loading}
              className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-cyan-900/20 transition-all flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Select This Folder
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
