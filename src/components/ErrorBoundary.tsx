import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component:', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[300px] flex items-center justify-center p-6 bg-rose-50/50 rounded-2xl border border-rose-200 shadow-xs m-4">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                {this.props.fallbackTitle || 'Terjadi Kendala Tampilan'}
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Data presensi Anda tetap tersimpan aman. Silakan muat ulang komponen untuk melanjutkan.
              </p>
              {this.state.error && (
                <p className="text-xs font-mono text-rose-700 bg-rose-100/70 p-2 rounded-lg mt-3 overflow-x-auto text-left">
                  {this.state.error.message}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl shadow-sm transition active:scale-95 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Pulihkan Tampilan</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
