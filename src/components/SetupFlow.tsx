import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { ExportSet, IngestionProgress, IngestionResult } from "../types";
import { listen } from "@tauri-apps/api/event";
import { Toast } from "../hooks/useToast";
import { Card, Button, Badge } from "./ui";
import { cn } from "../lib/utils";

interface SetupFlowProps {
  onComplete: () => void;
  progress: IngestionProgress | null;
  addToast: (type: Toast["type"], message: string) => void;
}

export function SetupFlow({ onComplete, progress, addToast }: SetupFlowProps) {
  const [detected, setDetected] = useState<ExportSet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<IngestionResult | null>(null);
  const scanInFlight = useRef(false);

  useEffect(() => {
    const unlisten = listen<IngestionResult>("ingestion-result", (event) => {
      setImportResult(event.payload);
    });
    return () => { unlisten.then((f) => f()); };
  }, []);

  async function handleScan() {
    if (scanInFlight.current) return;
    scanInFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const results: ExportSet[] = await invoke("auto_detect_exports");
      setDetected(results);
      if (results.length === 0) {
        setError("No Snapchat exports found automatically. Select your .zip file or unzipped folder below.");
      }
    } catch (e) {
      setError(friendlyError(String(e)));
    } finally {
      setLoading(false);
      scanInFlight.current = false;
    }
  }

  async function handlePickFolder() {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select your Snapchat \"My Data\" export folder",
    });
    if (selected) {
      await detectFromPath(selected);
    }
  }

  async function handlePickZip() {
    const selected = await open({
      directory: false,
      multiple: false,
      title: "Select your Snapchat export zip file",
      filters: [{ name: "Zip Archives", extensions: ["zip"] }],
    });
    if (selected) {
      await detectFromPath(selected);
    }
  }

  async function detectFromPath(path: string) {
    setLoading(true);
    setError(null);
    try {
      const results: ExportSet[] = await invoke("detect_exports", { path });
      if (results.length === 0) {
        setError(
          "That doesn't look like a Snapchat export. For folders, make sure it contains \"index.html\" and an \"html\" subdirectory. For zip files, make sure it's the original download from Snapchat."
        );
      } else {
        setDetected(results);
      }
    } catch (e) {
      setError(friendlyError(String(e)));
    } finally {
      setLoading(false);
    }
  }

  async function handleProcess(exp: ExportSet) {
    setError(null);
    setImportResult(null);
    try {
      await invoke("process_export", { export: exp });
    } catch (e) {
      setError(friendlyError(String(e)));
      addToast("error", "Import failed. Check the error above for details.");
    }
  }

  function friendlyError(raw: string): string {
    if (raw.includes("database is locked")) return "The database is locked by another process. Close other instances and try again.";
    if (raw.includes("UNIQUE constraint")) return "This export has already been imported. Reset your data first if you want to re-import.";
    if (raw.includes("No such file")) return "A required file was missing from the export. The export may be incomplete.";
    if (raw.includes("Invalid zip file")) return "The file doesn't appear to be a valid zip archive. Make sure the download completed successfully.";
    if (raw.includes("Zip archive is empty")) return "The zip archive is empty. Try re-downloading your Snapchat data export.";
    return raw;
  }

  useEffect(() => {
    handleScan();
  }, []);

  const isDone = progress?.current_step === "Complete" || importResult !== null;

  return (
    <div className="fixed inset-0 z-50 bg-surface-950/95 backdrop-blur-xl flex items-center justify-center p-8">
      <Card variant="elevated" padding="none" className="max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh] shadow-2xl border-surface-800">
        {/* Header */}
        <div className="p-8 border-b border-surface-100 dark:border-surface-800 bg-linear-to-br from-surface-50 to-white dark:from-surface-800 dark:to-brand-950/20">
          <div className="flex items-center gap-5 mb-2">
            <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-brand-500 to-accent-purple flex items-center justify-center shadow-lg shadow-brand-500/25 shrink-0">
              <img src="/logo.png" alt="" className="w-10 h-10 object-contain" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-surface-900 dark:text-white tracking-tight">
                Welcome to Snap Explorer
              </h1>
              <p className="text-surface-500 dark:text-surface-400 text-lg">
                Reconstruct and explore your digital history.
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          {/* How-to guidance */}
          {!progress && !importResult && (
            <div className="bg-brand-500/5 dark:bg-brand-500/10 border border-brand-500/20 rounded-2xl p-6 space-y-4">
              <h3 className="font-bold text-brand-600 dark:text-brand-400 text-sm uppercase tracking-widest flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Preparation Guide
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-lg bg-brand-500 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-lg shadow-brand-500/20">1</span>
                  <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                    Sign in to <code className="font-mono text-brand-500 bg-brand-500/10 px-1 rounded-sm">accounts.snapchat.com</code>
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-lg bg-brand-500 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-lg shadow-brand-500/20">2</span>
                  <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                    Submit a <span className="text-white font-medium">"My Data"</span> download request.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-lg bg-brand-500 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-lg shadow-brand-500/20">3</span>
                  <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                    Download the <span className="text-white font-medium">ZIP</span> file when notified.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-lg bg-brand-500 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-lg shadow-brand-500/20">4</span>
                  <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                    Select that <strong>ZIP</strong> or its extracted folder below.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Progress State */}
          {progress && !isDone ? (
            <div className="space-y-8 py-6">
              <div className="flex justify-between items-end">
                <div>
                  <h3 className="text-2xl font-bold text-surface-900 dark:text-white mb-1">{progress.current_step}</h3>
                  <p className="text-surface-500 dark:text-surface-400">{progress.message}</p>
                </div>
                <span className="text-brand-400 font-mono font-black text-3xl">
                  {Math.round(progress.progress * 100)}%
                </span>
              </div>
              <div className="h-4 w-full bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden p-1 shadow-inner">
                <div
                  className="h-full bg-linear-to-r from-brand-500 via-accent-purple to-accent-cyan transition-all duration-500 ease-out rounded-full shadow-lg"
                  style={{ width: `${progress.progress * 100}%` }}
                />
              </div>
              <div className="bg-surface-800/50 p-4 rounded-xl border border-surface-700">
                <p className="text-center text-sm text-surface-400 leading-relaxed">
                  We're performing deep reconstruction of your history. For large archives, this process handles thousands of media links and chat events.
                </p>
              </div>
            </div>
          ) : isDone && importResult ? (
            /* Completion State */
            <div className="space-y-8 py-4">
              <div className="text-center">
                <div className={cn(
                  "w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-xl",
                  importResult.errors.length > 0
                    ? "bg-amber-500/20 text-amber-500"
                    : "bg-green-500/20 text-green-500"
                )}>
                  {importResult.errors.length > 0 ? (
                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  ) : (
                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <h3 className="text-3xl font-black text-surface-900 dark:text-white mb-2">
                  {importResult.errors.length > 0 ? "Import Partial" : "System Primed"}
                </h3>
                <p className="text-surface-400">Your Snapchat archive has been successfully reconstructed locally.</p>
              </div>

              <div className="grid grid-cols-3 gap-5">
                <Card variant="surface" padding="lg" className="text-center border-surface-800 bg-surface-900/40">
                  <p className="text-3xl font-black text-brand-400 mb-1">{importResult.conversations_parsed}</p>
                  <p className="text-[10px] font-bold text-surface-500 uppercase tracking-widest leading-none">Chats</p>
                </Card>
                <Card variant="surface" padding="lg" className="text-center border-surface-800 bg-surface-900/40">
                  <p className="text-3xl font-black text-brand-400 mb-1">{importResult.events_parsed.toLocaleString()}</p>
                  <p className="text-[10px] font-bold text-surface-500 uppercase tracking-widest leading-none">Events</p>
                </Card>
                <Card variant="surface" padding="lg" className="text-center border-surface-800 bg-surface-900/40">
                  <p className="text-3xl font-black text-brand-400 mb-1">{importResult.memories_parsed}</p>
                  <p className="text-[10px] font-bold text-surface-500 uppercase tracking-widest leading-none">Memories</p>
                </Card>
              </div>

              {importResult.warnings.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5">
                  <p className="font-bold text-amber-500 text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Integrity Alerts ({importResult.warnings.length})
                  </p>
                  <ul className="text-sm text-surface-400 space-y-2 max-h-32 overflow-y-auto custom-scrollbar pr-2">
                    {importResult.warnings.map((w, i) => (
                      <li key={i} className="flex gap-2 items-start text-amber-200/60 font-medium">
                        <span className="text-amber-500 shrink-0">•</span>
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Button onClick={onComplete} size="lg" className="w-full h-14 text-lg font-bold shadow-brand-500/20 shadow-xl">
                Launch Dashboard
              </Button>
            </div>
          ) : (
            /* Selection State */
            <>
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-5 rounded-2xl flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-red-300">Detection Issue</p>
                    <p className="text-sm opacity-80">{error}</p>
                  </div>
                </div>
              )}

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-surface-900 dark:text-white">Detected Exports</h2>
                    {detected.length > 0 && <Badge variant="info">{detected.length}</Badge>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={handlePickZip} className="hover:bg-surface-800">
                      Zip File
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handlePickFolder} className="hover:bg-surface-800">
                      Folder
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleScan} disabled={loading} className="border-surface-700">
                      <svg className={cn("w-4 h-4 mr-2", loading && "animate-spin")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Rescan
                    </Button>
                  </div>
                </div>

                {loading ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-6 text-surface-500 bg-surface-900/30 rounded-3xl border border-surface-800 border-dashed">
                    <div className="w-16 h-16 border-4 border-surface-800 border-t-brand-500 rounded-full animate-spin" />
                    <p className="font-bold tracking-widest uppercase text-xs">Accessing File System...</p>
                  </div>
                ) : detected.length > 0 ? (
                    <div className="max-h-[380px] overflow-y-auto pr-2 custom-scrollbar space-y-3 p-1">
                    {detected.map((exp) => (
                      <Card
                        key={exp.id}
                        variant="glass"
                        padding="md"
                        className="group hover:border-brand-500/50 hover:bg-brand-500/5 transition-all duration-300 flex items-center justify-between border-surface-800 backdrop-blur-xs"
                      >
                        <div className="flex items-center gap-5 min-w-0">
                          <div className="w-14 h-14 bg-surface-800 rounded-2xl flex items-center justify-center group-hover:bg-brand-500/20 group-hover:text-brand-400 transition-colors shrink-0">
                            {exp.source_type === "Zip" ? (
                              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                              </svg>
                            ) : (
                              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                              </svg>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-white group-hover:text-brand-400 transition-colors truncate">
                              {exp.id}
                            </h4>
                            <p className="text-[10px] text-surface-500 font-mono mt-1 truncate max-w-[300px]" title={exp.source_paths.join(', ')}>
                              {exp.source_paths.length > 1 
                                ? `${exp.source_paths.length} components detected` 
                                : exp.source_paths[0]}
                            </p>
                            <div className="flex gap-2 mt-2">
                              <Badge variant={exp.validation_status === "Valid" ? "success" : "warning"} size="sm">
                                {exp.validation_status}
                              </Badge>
                              <Badge variant="default" size="sm" className="opacity-60 text-[10px]">
                                {exp.source_type.toUpperCase()} {exp.source_paths.length > 1 && `(${exp.source_paths.length} PARTS)`}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleProcess(exp)}
                          variant={exp.validation_status === "Valid" ? "solid" : "outline"}
                          className="shrink-0 font-bold ml-4"
                        >
                          Process
                        </Button>
                      </Card>
                    ))}
                  </div>
                ) : !error ? (
                  <div className="py-20 text-center bg-surface-900/30 rounded-3xl border-2 border-dashed border-surface-800 flex flex-col items-center">
                    <div className="w-20 h-20 rounded-3xl bg-surface-800 flex items-center justify-center mb-6 shadow-xl">
                      <svg className="w-10 h-10 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Manual Selection Required</h3>
                    <p className="text-surface-500 max-w-sm mb-8 leading-relaxed">
                      We couldn't find any Snapchat data in standard locations. Please point us to your archive.
                    </p>
                    <div className="flex gap-4">
                      <Button onClick={handlePickZip} className="px-8 font-bold">Zip Archive</Button>
                      <Button variant="outline" onClick={handlePickFolder} className="px-8 border-surface-700">Folder</Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 bg-surface-50 dark:bg-surface-800/50 border-t border-surface-100 dark:border-surface-800 flex justify-center">
          <p className="text-xs text-surface-400 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Your data stays local and is never uploaded
          </p>
        </div>
      </Card>
    </div>
  );
}
