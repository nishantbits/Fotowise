
import { useState, lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './components/layout/AppShell';
import { AnimatePresence } from 'framer-motion';

import { SplashScreen } from './components/ui/SplashScreen';
import { ToastContainer } from './components/ui/Toast';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { useUIStore } from './stores/useUIStore';
import { OnboardingModal } from './components/onboarding-modal';

const Dashboard     = lazy(() => import('./pages/Dashboard'));
const FullView      = lazy(() => import('./pages/FullView'));
const Explore       = lazy(() => import('./pages/Explore'));
const ScreenshotsPage  = lazy(() => import('./pages/explore/ScreenshotsPage'));
const BlurryPhotosPage = lazy(() => import('./pages/explore/BlurryPhotosPage'));
const DuplicatesPage   = lazy(() => import('./pages/explore/DuplicatesPage'));
const PeoplePage       = lazy(() => import('./pages/explore/PeoplePage'));
const PersonPhotosPage = lazy(() => import('./pages/explore/PersonPhotosPage'));
const DocumentsPage    = lazy(() => import('./pages/explore/DocumentsPage'));
const SearchPage       = lazy(() => import('./pages/explore/SearchPage'));
const NotFound         = lazy(() => import('./pages/NotFound'));
const MemoriesPage     = lazy(() => import('./components/memories/MemoriesPage').then(m => ({ default: m.MemoriesPage })));
const Settings         = lazy(() => import('./pages/Settings'));
const AllMedia         = lazy(() => import('./pages/AllMedia'));

const Downloads = () => <div className="p-6">Downloads Page</div>;
const Albums    = () => <div className="p-6 flex h-full items-center justify-center text-[var(--t2)] text-xl">Albums Page - Coming Soon</div>;
const Shared    = () => <div className="p-6">Shared Page</div>;

const queryClient = new QueryClient();

// ─── Theme manager ───────────────────────────────────────────────────────────
function ThemeManager() {
  const theme       = useUIStore((s) => s.theme);
  const accentColor = useUIStore((s) => s.accentColor);

  useEffect(() => {
    const root     = document.documentElement;
    const applyDark = (dark: boolean) => root.classList.toggle('dark', dark);

    if (theme === 'dark') {
      applyDark(true);
    } else if (theme === 'light') {
      applyDark(false);
    } else {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      applyDark(mq.matches);
      const handler = (e: MediaQueryListEvent) => applyDark(e.matches);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent',           accentColor);
    root.style.setProperty('--accent-green',     accentColor);
    root.style.setProperty('--accent-dim',       `${accentColor}cc`);
    root.style.setProperty('--accent-green-dim', `${accentColor}cc`);
  }, [accentColor]);

  return null;
}

// ─── Seamless page fallback ───────────────────────────────────────────────────
// Matches the page background exactly so lazy-chunk loads are invisible.
function PageFallback() {
  return (
    <div
      className="flex-1 flex flex-col gap-6 p-8"
      style={{ background: 'var(--bg)' }}
    >
      <div className="h-8 w-48 rounded-xl animate-pulse" style={{ background: 'var(--bg-surface)' }} />
      <div className="h-4 w-64 rounded-lg animate-pulse opacity-60" style={{ background: 'var(--bg-surface)' }} />
      <div className="grid grid-cols-4 gap-4 mt-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-2xl animate-pulse"
            style={{ background: 'var(--bg-surface)', animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Animated routes — must live inside BrowserRouter ─────────────────────────
// 
// Architecture explanation:
//  • useLocation() inside BrowserRouter gives us the live location object.
//  • We pass `location` to <Routes> so React Router keeps the *exiting*
//    component mounted while AnimatePresence plays its exit animation.
//  • <AnimatePresence mode="wait"> sits OUTSIDE <Suspense>, so Framer Motion
//    can see the full mount/unmount lifecycle without Suspense interrupting it.
//  • The per-route <Suspense> fallback matches bg-color so the first-load
//    chunk download is invisible (no white/black flash).
//
function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      {/*
        key={location.pathname} — tells AnimatePresence a NEW child is mounting.
        location prop on Routes — keeps the exiting route mounted during exit anim.
      */}
      <Routes location={location} key={location.pathname}>
        <Route element={<AppShell />}>
          <Route path="/"                         element={<Suspense fallback={<PageFallback />}><Dashboard /></Suspense>} />
          <Route path="/explore"                  element={<Suspense fallback={<PageFallback />}><Explore /></Suspense>} />
          <Route path="/explore/screenshots"      element={<Suspense fallback={<PageFallback />}><ScreenshotsPage /></Suspense>} />
          <Route path="/explore/blurry"           element={<Suspense fallback={<PageFallback />}><BlurryPhotosPage /></Suspense>} />
          <Route path="/explore/duplicates"       element={<Suspense fallback={<PageFallback />}><DuplicatesPage /></Suspense>} />
          <Route path="/explore/people"           element={<Suspense fallback={<PageFallback />}><PeoplePage /></Suspense>} />
          <Route path="/explore/people/:clusterId" element={<Suspense fallback={<PageFallback />}><PersonPhotosPage /></Suspense>} />
          <Route path="/explore/documents"        element={<Suspense fallback={<PageFallback />}><DocumentsPage /></Suspense>} />
          <Route path="/explore/search"           element={<Suspense fallback={<PageFallback />}><SearchPage /></Suspense>} />
          <Route path="/albums"                   element={<Albums />} />
          <Route path="/shared"                   element={<Shared />} />
          <Route path="/downloads"                element={<Downloads />} />
          <Route path="/settings"                 element={<Suspense fallback={<PageFallback />}><Settings /></Suspense>} />
          <Route path="/memories"                 element={<Suspense fallback={<PageFallback />}><MemoriesPage /></Suspense>} />
          <Route path="/media"                    element={<Suspense fallback={<PageFallback />}><AllMedia /></Suspense>} />
          <Route path="*"                         element={<Suspense fallback={<PageFallback />}><NotFound /></Suspense>} />
        </Route>
        {/* FullView is full-screen (no AppShell sidebar) */}
        <Route path="/media/:id" element={<Suspense fallback={<div className="flex h-screen w-full items-center justify-center bg-black" />}><FullView /></Suspense>} />
      </Routes>
    </AnimatePresence>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/settings?t=${new Date().getTime()}`, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data.has_completed_onboarding !== 'true') {
          setShowOnboarding(true);
        }
      })
      .catch(console.error)
      .finally(() => setIsSettingsLoaded(true));
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ThemeManager />
          {(showSplash || !isSettingsLoaded) && <SplashScreen onComplete={() => setShowSplash(false)} />}
          {isSettingsLoaded && showOnboarding && <OnboardingModal />}
          {isSettingsLoaded && <AnimatedRoutes />}
          <ToastContainer />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
