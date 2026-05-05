import { useEffect, useRef } from 'react';
import { useJobStore } from '../stores/useJobStore';

const WS_URL = (import.meta.env.VITE_WS_URL || 'ws://localhost:3000') + '/ws/progress';
const RECONNECT_DELAY_MS = 5000;

/**
 * useWebSocket — opens a single WebSocket connection to the server
 * and dispatches incoming messages to the appropriate stores.
 *
 * Call this ONCE at the app root level (in App.tsx or AppShell.tsx).
 */
export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { upsertJob, updateProgress, markCompleted, markFailed, setWsConnected } = useJobStore();

  useEffect(() => {
    let isMounted = true;

    function connect() {
      if (!isMounted) return;

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isMounted) setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          switch (msg.type) {
            case 'job_started':
              upsertJob(msg.job);
              break;
            case 'job_progress':
              updateProgress(msg.jobId, msg.progress);
              break;
            case 'job_completed':
              markCompleted(msg.jobId, msg.total);
              break;
            case 'job_failed':
              markFailed(msg.jobId, msg.error);
              break;
            default:
              break; // ignore unknown message types
          }
        } catch {
          // non-JSON or malformed message — ignore silently
        }
      };

      ws.onclose = () => {
        if (!isMounted) return;
        setWsConnected(false);
        // Auto-reconnect after delay
        reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
      };

      ws.onerror = () => {
        ws.close(); // triggers onclose → reconnect
      };
    }

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, []); // run once on mount
}
