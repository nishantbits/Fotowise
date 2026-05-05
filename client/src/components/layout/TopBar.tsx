import { useState, useEffect, useRef } from 'react';
import { Search, Grid, Command, Plus, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useSearchStore } from '../../stores/useSearchStore';
import { useUIStore } from '../../stores/useUIStore';
import { TaskIndicator } from './TaskIndicator';

interface TopBarProps {
  title?: string;
  /** When true, hides the search bar, upload button, and grid toggle */
  hideActions?: boolean;
}

export function TopBar({ title, hideActions = false }: TopBarProps) {
  const [greeting, setGreeting] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { setSearchOverlayOpen, isSearching } = useSearchStore();
  const { setUploadModalOpen } = useUIStore();

  useEffect(() => {
    const updateGreeting = () => {
      const hour = new Date().getHours();
      if (hour < 12) setGreeting('Good morning');
      else if (hour < 18) setGreeting('Good afternoon');
      else setGreeting('Good evening');
    };
    updateGreeting();

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="h-[80px] px-8 flex items-center justify-between shrink-0 relative z-40 bg-transparent">
      {/* Greeting */}
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-display font-semibold text-[#eceef5]">
          {title ? title : (
            <>
              {greeting}, <span className="italic font-bold">User</span> <span className="text-[var(--accent)] ml-1">✦</span>
            </>
          )}
        </h1>
      </div>

      {/* Actions — hidden on pages that pass hideActions (e.g. Settings) */}
      {!hideActions && (
        <div className="flex items-center gap-6">
          {/* Search */}
          <div className="relative flex items-center group">
            <div
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[rgba(13,15,21,0.6)] border border-[rgba(236,238,245,0.08)] transition-all duration-300 backdrop-blur-md",
                isSearchFocused ? "w-[290px] border-[var(--accent)]/40 shadow-[0_0_20px_rgba(34,201,130,0.05)]" : "w-[230px]"
              )}
            >
              <Search size={18} className={isSearchFocused ? "text-[var(--accent)]" : "text-[#646a7e]"} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search library..."
                onFocus={() => {
                  setIsSearchFocused(true);
                  setSearchOverlayOpen(true);
                }}
                onBlur={() => setIsSearchFocused(false)}
                className="bg-transparent border-none outline-none text-sm text-[#eceef5] placeholder-[#646a7e] w-full"
              />
              {isSearching ? (
                <Loader2
                  size={14}
                  className="animate-spin text-[var(--accent)] flex-shrink-0"
                  aria-label="Searching…"
                />
              ) : !isSearchFocused ? (
                <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-[#646a7e]/30 text-[#646a7e]">
                  <Command size={10} />
                  <span className="text-[10px] font-bold">K</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              title="Upload Media"
              onClick={() => setUploadModalOpen(true)}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[#161922] transition-all group"
            >
              <Plus size={20} />
            </button>
            <TaskIndicator />
            <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-[rgba(13,15,21,0.6)] border border-[rgba(236,238,245,0.08)] text-[#a0a6b9] hover:text-[#eceef5] transition-all group">
              <Grid size={20} />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
