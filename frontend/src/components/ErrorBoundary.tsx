import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[APIForge ErrorBoundary] Caught unhandled rendering error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetWorkspace = () => {
    try {
      localStorage.removeItem('apiforge_active_env_id');
    } catch {
      // Ignore localStorage errors
    }
    window.location.href = '/';
  };

  private toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-sans">
          <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 flex flex-col space-y-6 animate-fade-in">
            {/* Header Icon & Title */}
            <div className="flex items-center space-x-3.5">
              <div className="w-11 h-11 rounded-xl bg-rose-950/80 border border-rose-800/50 flex items-center justify-center text-rose-400 shrink-0 shadow-lg shadow-rose-900/20">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-100">Something went wrong</h1>
                <p className="text-xs text-slate-400">An unexpected error occurred in the workspace.</p>
              </div>
            </div>

            {/* Error Message Box */}
            <div className="bg-slate-950/80 border border-slate-850 rounded-xl p-3.5 font-mono text-xs text-rose-300 break-words leading-relaxed">
              {this.state.error?.message || 'Unknown application error'}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2.5 px-4 rounded-xl transition duration-150 flex items-center justify-center space-x-2 cursor-pointer shadow-lg shadow-indigo-600/25"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Reload Application</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetWorkspace}
                className="w-full sm:flex-1 bg-slate-800 hover:bg-slate-750 text-slate-200 font-medium text-xs py-2.5 px-4 rounded-xl border border-slate-700/80 transition duration-150 flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>Reset Workspace</span>
              </button>
            </div>

            {/* Technical Details Toggle */}
            <div className="pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={this.toggleDetails}
                className="text-[11px] text-slate-500 hover:text-slate-400 font-mono transition flex items-center space-x-1 cursor-pointer"
              >
                <span>{this.state.showDetails ? 'Hide technical details' : 'Show technical details'}</span>
                <svg className={`w-3 h-3 transition-transform ${this.state.showDetails ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {this.state.showDetails && this.state.errorInfo && (
                <pre className="mt-2.5 bg-slate-950 border border-slate-850 p-3 rounded-lg text-[10px] font-mono text-slate-400 overflow-auto max-h-40 leading-normal select-text">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
