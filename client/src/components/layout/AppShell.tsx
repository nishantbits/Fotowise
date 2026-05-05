import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { SearchOverlay } from '../search/SearchOverlay';
import { OfflineBanner } from '../ui/OfflineBanner';
import { motion } from 'framer-motion';
import { useUIStore } from '../../stores/useUIStore';
import { useWebSocket } from '../../hooks/useWebSocket';

// Page transition variants — defined once here, consumed by the motion.div
// that wraps <Outlet>. AnimatePresence lives in the parent (App.tsx →
// AnimatedRoutes), so this motion.div correctly receives mount/unmount signals.
const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -5 },
};

const pageTransition = {
  duration: 0.25,
  ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
};

export function AppShell() {
  const location   = useLocation();
  const accentColor = useUIStore((state) => state.accentColor);

  // Establish the single persistent WebSocket connection for the whole session
  useWebSocket();

  const shellStyle = {
    '--accent':     accentColor,
    '--accent-dim': `${accentColor}cc`,
  } as React.CSSProperties;

  return (
    <div
      className="flex h-screen w-full flex-row overflow-hidden bg-[var(--bg)] text-[var(--t1)] relative"
      style={shellStyle}
    >
      <div className="grain-overlay" />
      <OfflineBanner />
      <Sidebar />

      {/*
        Content area: min-h-0 + flex-1 so it fills remaining space without
        overflow bleeding into the sidebar. overflow-hidden clips the y-slide
        animation cleanly without scrollbars flashing.
      */}
      <div className="flex flex-1 flex-col min-h-0 overflow-hidden relative">
        {/*
          motion.div is the animation target. It receives variants from the
          AnimatePresence in AnimatedRoutes (App.tsx). The key is already set
          on the <Routes> element, so Framer Motion knows to animate on change.
          We set it here again on location.pathname as a belt-and-suspenders
          guarantee that the element truly remounts on route change.
        */}
        <motion.div
          key={location.pathname}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={pageTransition}
          className="flex flex-1 flex-col min-h-0 overflow-hidden"
        >
          <Outlet />
        </motion.div>

        <SearchOverlay />
      </div>
    </div>
  );
}
