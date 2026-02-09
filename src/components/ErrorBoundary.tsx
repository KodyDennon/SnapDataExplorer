import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
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
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-slate-900 flex flex-col items-center justify-center gap-6 p-8 text-center">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center">
            <span className="text-4xl">!</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
          <p className="text-slate-400 max-w-md">
            Snap Explorer encountered an unexpected error. Your data is safe — try reloading.
          </p>
          {this.state.error && (
            <pre className="text-xs text-slate-500 bg-slate-800 rounded-xl p-4 max-w-lg overflow-x-auto">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleReload}
            className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all"
          >
            Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
