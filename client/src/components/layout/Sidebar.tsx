import { NavLink } from 'react-router-dom';
import { Home, Compass, Sparkles, Folder, Search, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';

const navItems = [
  { name: 'Home',         icon: Home,     path: '/' },
  { name: 'Explore',      icon: Compass,  path: '/explore' },
  { name: 'Memories',     icon: Sparkles, path: '/memories' },
  { name: 'Albums',       icon: Folder,   path: '/albums' },
  { name: 'Smart Search', icon: Search,   path: '/explore/search' },
];

function NavIcon({ name, icon: Icon, path }: typeof navItems[number]) {
  return (
    <NavLink
      to={path}
      title={name}
      end={path === '/' || path === '/explore'}
      className={({ isActive }) => cn(
        'relative group w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-300 hover:scale-[1.08]',
        isActive ? 'bg-accent/10 text-accent' : 'text-t2 hover:text-t1'
      )}
    >
      {({ isActive }) => (
        <>
          <Icon size={18} className="relative z-10" />
          {/* Active indicator bar */}
          {isActive && (
            <div className="absolute right-[-4px] top-1/2 -translate-y-1/2 w-[3px] h-4 bg-accent rounded-full shadow-[0_0_8px_var(--accent)]" />
          )}
          {/* Tooltip */}
          <span className="absolute left-[calc(100%+12px)] px-2 py-1 rounded-md bg-[#161922] text-[#eceef5] text-xs font-medium opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap border border-white/5 z-50">
            {name}
          </span>
        </>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  return (
    <aside className="w-[64px] h-screen flex flex-col items-center justify-center shrink-0 relative z-50">
      <div className="flex flex-col items-center w-[48px] bg-glass-bg backdrop-blur-glass saturate-[1.6] rounded-[24px] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_0_0_1px_rgba(255,255,255,0.05)] overflow-hidden">

        {/* ── Logo ─────────────────────────────────── */}
        <div className="pt-5 pb-4">
          <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-gradient-to-br from-[#1a1c26] to-[#07080c] border border-white/5">
            <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
              <rect x="3" y="2" width="4.5" height="16" rx="1" fill="#eceef5"/>
              <rect x="3" y="2" width="13" height="4" rx="1" fill="#eceef5"/>
              <rect x="3" y="9" width="9" height="3.5" rx="1" fill="#eceef5"/>
              <polygon points="16,2 16,6 12,6" fill="#07080c" opacity=".95"/>
              <circle cx="18" cy="18" r="4" fill="var(--accent)"/>
              <circle cx="18" cy="18" r="1.8" fill="var(--accent-dim)"/>
            </svg>
          </div>
        </div>

        {/* ── Thin divider ─────────────────────────── */}
        <div className="w-6 h-px bg-white/8 mb-3" />

        {/* ── Main navigation ──────────────────────── */}
        <nav className="flex flex-col items-center gap-1.5 w-full px-2">
          {navItems.map((item) => (
            <NavIcon key={item.name} {...item} />
          ))}
        </nav>

        {/* ── Thin divider ─────────────────────────── */}
        <div className="w-6 h-px bg-white/8 mt-3 mb-3" />

        {/* ── Settings (bottom utility) ─────────────── */}
        <div className="pb-5">
          <NavLink
            to="/settings"
            title="Settings"
            className={({ isActive }) => cn(
              'relative group w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-300 hover:scale-[1.08]',
              isActive ? 'bg-accent/10 text-accent' : 'text-t2 hover:text-t1'
            )}
          >
            {({ isActive }) => (
              <>
                <Settings size={18} className="relative z-10" />
                {isActive && (
                  <div className="absolute right-[-4px] top-1/2 -translate-y-1/2 w-[3px] h-4 bg-accent rounded-full shadow-[0_0_8px_var(--accent)]" />
                )}
                <span className="absolute left-[calc(100%+12px)] px-2 py-1 rounded-md bg-[#161922] text-[#eceef5] text-xs font-medium opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap border border-white/5 z-50">
                  Settings
                </span>
              </>
            )}
          </NavLink>
        </div>
      </div>
    </aside>
  );
}
