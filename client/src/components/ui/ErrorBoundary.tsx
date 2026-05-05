import React, { Component, type ErrorInfo } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-[var(--bg-primary)] p-6 text-center text-white">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
            <AlertTriangle className="h-10 w-10 text-red-500" />
          </div>
          <h1 className="mb-2 text-3xl font-bold tracking-tight">Something went wrong</h1>
          <p className="mb-8 max-w-md text-gray-400">
            An unexpected error occurred in the application. You can try refreshing the page or returning to the dashboard.
          </p>
          
          <div className="flex gap-4">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 rounded-full bg-[var(--accent-green)] px-6 py-3 font-semibold text-black transition-transform hover:scale-105"
            >
              <RefreshCw className="h-5 w-5" />
              Reload Page
            </button>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = '/';
              }}
              className="rounded-full bg-white/10 px-6 py-3 font-semibold text-white transition-colors hover:bg-white/20"
            >
              Go to Dashboard
            </button>
          </div>

          {import.meta.env.MODE === 'development' && this.state.error && (
            <div className="mt-12 w-full max-w-2xl rounded-lg bg-black/50 p-4 text-left font-mono text-sm text-red-400 overflow-auto max-h-64 border border-red-500/20">
              {this.state.error.toString()}
              <br />
              {this.state.error.stack}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
