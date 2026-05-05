import { useNavigate } from 'react-router-dom';
import { Home, Telescope } from 'lucide-react';
import { TopBar } from '../components/layout/TopBar';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col">
      <TopBar title="Not Found" />
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <div className="mb-8 relative flex h-40 w-40 items-center justify-center rounded-full bg-[var(--bg-elevated)] shadow-inner">
          <Telescope className="h-20 w-20 text-[var(--accent-green)] opacity-80" />
          <div className="absolute -bottom-2 -right-2 flex h-16 w-16 items-center justify-center rounded-full bg-black border-4 border-[var(--bg-primary)]">
            <span className="text-xl font-bold text-gray-400">404</span>
          </div>
        </div>
        
        <h1 className="mb-3 text-4xl font-bold tracking-tight text-white font-syne drop-shadow-sm">Lost in the Archives</h1>
        <p className="mb-10 max-w-md text-lg text-gray-400 leading-relaxed font-dm">
          The memory you're looking for seems to have drifted away. It might have been deleted, or the link may be broken.
        </p>

        <button
          onClick={() => navigate('/')}
          data-testid="notfound-return-btn"
          className="group flex items-center gap-3 rounded-full bg-[var(--accent-green)] px-8 py-3.5 font-semibold text-black transition-all hover:scale-105 hover:shadow-lg hover:shadow-[var(--accent-green)]/20 active:scale-95"
        >
          <Home className="h-5 w-5 transition-transform group-hover:-translate-y-0.5" />
          Return to Dashboard
        </button>
      </div>
    </div>
  );
}
