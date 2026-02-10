import { Component, ErrorInfo, ReactNode } from "react";
import { generateCrashReport } from "../lib/errorReporter";
import { AlertCircle, RefreshCw, ClipboardList, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../lib/utils";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  copying: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null, 
      showDetails: false,
      copying: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleCopyReport = async () => {
    if (!this.state.error) return;
    this.setState({ copying: true });
    try {
      const report = await generateCrashReport(this.state.error, this.state.errorInfo?.componentStack);
      await navigator.clipboard.writeText(report);
      // We could use a toast here, but we're in a crash state, so simple alert or just changing button text
      setTimeout(() => this.setState({ copying: false }), 2000);
    } catch (err) {
      console.error("Failed to copy report:", err);
      this.setState({ copying: false });
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-surface-950 flex flex-col items-center justify-center p-6 text-center overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-500/5 via-transparent to-transparent pointer-events-none" />
          
          <div className="relative z-10 max-w-2xl w-full space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="w-24 h-24 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto border border-red-500/20 shadow-2xl shadow-red-500/10">
              <AlertCircle className="w-12 h-12 text-red-500" />
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-black text-white tracking-tight">System Interruption</h1>
              <p className="text-surface-400 text-lg leading-relaxed">
                Snap Explorer encountered a critical runtime error. Your local database remains intact and secure.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={this.handleReload}
                className="w-full sm:w-auto bg-brand-600 hover:bg-brand-500 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-xl shadow-brand-600/20"
              >
                <RefreshCw className="w-5 h-5" />
                Reload Application
              </button>
              
              <button
                onClick={this.handleCopyReport}
                disabled={this.state.copying}
                className="w-full sm:w-auto bg-surface-800 hover:bg-surface-700 text-surface-200 px-10 py-4 rounded-2xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <ClipboardList className="w-5 h-5" />
                {this.state.copying ? "Copied!" : "Copy Debug Info"}
              </button>
            </div>

            <div className="pt-8">
              <button 
                onClick={() => this.setState({ showDetails: !this.state.showDetails })}
                className="text-surface-500 hover:text-surface-300 text-xs font-bold uppercase tracking-widest flex items-center gap-2 mx-auto transition-colors"
              >
                {this.state.showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {this.state.showDetails ? "Hide" : "Show"} Technical Details
              </button>

              {this.state.showDetails && (
                <div className="mt-6 text-left bg-black/40 border border-surface-800 rounded-2xl p-6 max-h-60 overflow-y-auto custom-scrollbar animate-in slide-in-from-top-4 duration-300">
                  <p className="text-red-400 font-mono text-sm mb-4 font-bold">{this.state.error?.name}: {this.state.error?.message}</p>
                  <pre className="text-[10px] text-surface-500 font-mono leading-relaxed whitespace-pre-wrap">
                    {this.state.error?.stack}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </div>
              )}
            </div>
          </div>
          
          <p className="absolute bottom-8 text-[10px] font-bold text-surface-600 uppercase tracking-[0.2em]">
            Forensic Data Protection Active
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
