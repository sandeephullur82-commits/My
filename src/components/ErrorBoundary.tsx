import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: any;
}

interface State {
  hasError: boolean;
  error: any;
}

export class ErrorBoundary extends (React.Component as any) {
  state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    try {
      localStorage.removeItem('app_pin');
      localStorage.removeItem('cache_customers');
      localStorage.removeItem('cache_transactions');
    } catch {
      // ignore
    }
    window.location.href = '/';
  };

  render() {
    if ((this as any).state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-3xl flex items-center justify-center mb-5 border border-red-500/30">
            <AlertTriangle size={32} />
          </div>

          <h1 className="text-xl font-black tracking-tight mb-2">Pigmy Pro Workspace</h1>
          <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
            A temporary display error occurred while rendering this view. Tap below to reload and refresh the workspace.
          </p>

          {(this as any).state.error && (
            <div className="w-full max-w-md bg-slate-800/80 border border-slate-700/60 rounded-2xl p-3.5 mb-6 text-left overflow-auto max-h-36">
              <p className="text-[11px] font-mono text-red-300 break-all">
                {String((this as any).state.error?.message || (this as any).state.error)}
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
            <button
              onClick={this.handleReload}
              className="flex-1 h-11 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-blue-600/20"
            >
              <RefreshCw size={14} />
              <span>Reload App</span>
            </button>
            <button
              onClick={this.handleReset}
              className="flex-1 h-11 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all border border-slate-700"
            >
              <Home size={14} />
              <span>Home</span>
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
