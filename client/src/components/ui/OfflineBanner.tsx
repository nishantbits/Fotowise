import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="bg-yellow-500/90 text-black px-4 py-1.5 flex items-center justify-center gap-2 text-sm font-medium z-[100] backdrop-blur-md relative">
      <WifiOff className="h-4 w-4" />
      <span>You are currently offline. Changes will be synced when you reconnect.</span>
    </div>
  );
}
