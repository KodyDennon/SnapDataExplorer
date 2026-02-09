import { useState, useEffect } from "react";
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

  useEffect(() => {
    const unlisten = listen<IngestionResult>("ingestion-result", (event) => {
      setImportResult(event.payload);
    });
    return () => { unlisten.then((f) => f()); };
  }, []);

  async function handleScan() {
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
      <Card variant="elevated" padding="none" className="max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-10 border-b border-surface-100 dark:border-surface-800 bg-gradient-to-br from-surface-50 to-white dark:from-surface-800 dark:to-surface-900">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-purple flex items-center justify-center shadow-lg shadow-brand-500/25">
              <img src="/logo.png" alt="" className="w-9 h-9 object-contain" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-surface-900 dark:text-white">
                Welcome to Snap Explorer
              </h1>
              <p className="text-surface-500 dark:text-surface-400">
                Import your Snapchat data to begin
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
          {/* How-to guidance */}
          {!progress && !importResult && (
            <div className="bg-brand-50 dark:bg-brand-950/30 border border-brand-100 dark:border-brand-900/50 rounded-2xl p-5 space-y-3">
              <h3 className="font-bold text-brand-700 dark:text-brand-300 text-sm flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                How to get your data
              </h3>
              <ol className="text-sm text-brand-600 dark:text-brand-400 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-brand-200 dark:bg-brand-800 text-brand-700 dark:text-brand-300 flex items-center justify-center text-xs font-bold shrink-0">1</span>
                  Go to <code className="font-mono font-semibold bg-brand-100 dark:bg-brand-900 px-1 rounded">accounts.snapchat.com</code> and sign in
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-brand-200 dark:bg-brand-800 text-brand-700 dark:text-brand-300 flex items-center justify-center text-xs font-bold shrink-0">2</span>
                  Click "My Data" and submit a download request
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-brand-200 dark:bg-brand-800 text-brand-700 dark:text-brand-300 flex items-center justify-center text-xs font-bold shrink-0">3</span>
                  When ready, download the zip file
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-brand-200 dark:bg-brand-800 text-brand-700 dark:text-brand-300 flex items-center justify-center text-xs font-bold shrink-0">4</span>
                  Select the <strong>.zip file directly</strong> or unzip it and select the folder
                </li>
              </ol>
            </div>
          )}

          {/* Progress State */}
          {progress && !isDone ? (
            <div className="space-y-6 py-4">
              <div className="flex justify-between items-end mb-2">
                <div>
                  <h3 className="text-xl font-bold text-surface-800 dark:text-white">{progress.current_step}</h3>
                  <p className="text-surface-500 dark:text-surface-400 text-sm">{progress.message}</p>
                </div>
                <span className="text-brand-500 font-mono font-bold text-lg">
                  {Math.round(progress.progress * 100)}%
                </span>
              </div>
              <div className="h-3 w-full bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-500 to-accent-cyan transition-all duration-300 ease-out"
                  style={{ width: `${progress.progress * 100}%` }}
                />
              </div>
              <p className="text-center text-sm text-surface-400 italic">
                This might take a while for large archives. We're indexing everything for instant access later.
              </p>
            </div>
          ) : isDone && importResult ? (
            /* Completion State */
            <div className="space-y-6 py-4">
              <div className="text-center">
                <div className={cn(
                  "w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center",
                  importResult.errors.length > 0
                    ? "bg-amber-100 dark:bg-amber-900/30"
                    : "bg-green-100 dark:bg-green-900/30"
                )}>
                  {importResult.errors.length > 0 ? (
                    <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  ) : (
                    <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <h3 className="text-xl font-bold text-surface-900 dark:text-white">
                  {importResult.errors.length > 0 ? "Import completed with errors" : "Import Complete!"}
                </h3>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Card variant="surface" padding="md" className="text-center">
                  <p className="text-2xl font-bold text-surface-900 dark:text-white">{importResult.conversations_parsed}</p>
                  <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Conversations</p>
                </Card>
                <Card variant="surface" padding="md" className="text-center">
                  <p className="text-2xl font-bold text-surface-900 dark:text-white">{importResult.events_parsed.toLocaleString()}</p>
                  <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Messages</p>
                </Card>
                <Card variant="surface" padding="md" className="text-center">
                  <p className="text-2xl font-bold text-surface-900 dark:text-white">{importResult.memories_parsed}</p>
                  <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Memories</p>
                </Card>
              </div>

              {importResult.warnings.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                  <p className="font-semibold text-amber-700 dark:text-amber-400 text-sm mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    {importResult.warnings.length} warning(s)
                  </p>
                  <ul className="text-xs text-amber-600 dark:text-amber-400 space-y-1 max-h-24 overflow-y-auto custom-scrollbar">
                    {importResult.warnings.slice(0, 10).map((w, i) => (
                      <li key={i} className="truncate">{w}</li>
                    ))}
                    {importResult.warnings.length > 10 && (
                      <li className="italic">...and {importResult.warnings.length - 10} more</li>
                    )}
                  </ul>
                </div>
              )}

              <Button onClick={onComplete} size="lg" className="w-full">
                Continue to Dashboard
              </Button>
            </div>
          ) : (
            /* Selection State */
            <>
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-4 rounded-xl flex items-start gap-3">
                  <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-surface-800 dark:text-white">Detected Exports</h2>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={handlePickZip}>
                      Select Zip
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handlePickFolder}>
                      Select Folder
                    </Button>
                  </div>
                </div>

                {loading ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-4 text-surface-400">
                    <div className="w-10 h-10 border-4 border-surface-200 dark:border-surface-700 border-t-brand-500 rounded-full animate-spin" />
                    <p className="font-medium">Scanning for data...</p>
                  </div>
                ) : detected.length > 0 ? (
                  <div className="space-y-3">
                    {detected.map((exp) => (
                      <Card
                        key={exp.source_path}
                        variant="surface"
                        padding="md"
                        className="group hover:border-brand-300 dark:hover:border-brand-600 transition-all flex items-center justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-surface-100 dark:bg-surface-700 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                            {exp.source_type === "Zip" ? (
                              <svg className="w-6 h-6 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                              </svg>
                            ) : (
                              <svg className="w-6 h-6 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <h4 className="font-semibold text-surface-900 dark:text-white truncate max-w-[200px]">
                              {exp.id}
                            </h4>
                            <p className="text-xs text-surface-400 font-mono mt-0.5 truncate max-w-[280px]">
                              {exp.source_path}
                            </p>
                            <div className="flex gap-2 mt-2">
                              <Badge variant={exp.validation_status === "Valid" ? "success" : "warning"} size="sm">
                                {exp.validation_status}
                              </Badge>
                              <Badge variant="default" size="sm">
                                {exp.source_type}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <Button onClick={() => handleProcess(exp)}>
                          Import
                        </Button>
                      </Card>
                    ))}
                  </div>
                ) : !error ? (
                  <div className="py-12 text-center bg-surface-50 dark:bg-surface-800 rounded-2xl border-2 border-dashed border-surface-200 dark:border-surface-700">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-surface-100 dark:bg-surface-700 flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <p className="text-surface-500 font-medium mb-4">No exports found automatically</p>
                    <div className="flex gap-3 justify-center">
                      <Button onClick={handlePickZip}>Select Zip File</Button>
                      <Button variant="outline" onClick={handlePickFolder}>Select Folder</Button>
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
