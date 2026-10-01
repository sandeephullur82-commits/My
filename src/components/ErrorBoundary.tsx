import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  props: Props;
  state: State = {
    hasError: false,
    error: null
  };

  constructor(props: Props) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught application error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg flex items-center justify-center p-6 text-text-primary">
          <div className="max-w-md w-full bg-card p-6 sm:p-8 rounded-3xl border border-border shadow-xl text-center space-y-4">
            <div className="w-14 h-14 bg-danger/10 text-danger rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle size={28} />
            </div>
            <div>
              <h2 className="text-lg font-bold">Something went wrong</h2>
              <p className="text-xs text-text-secondary mt-1">
                {this.state.error?.message || 'An unexpected error occurred in the workspace.'}
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                onClick={this.handleReload}
                className="px-4 py-2.5 bg-accent text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:opacity-90 transition-all active:scale-95"
              >
                <RefreshCw size={14} />
                <span>Reload App</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
