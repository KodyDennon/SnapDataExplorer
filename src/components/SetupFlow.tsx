import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { ExportSet, IngestionProgress, IngestionResult } from "../types";
import { listen } from "@tauri-apps/api/event";
import { Toast } from "../hooks/useToast";

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
    <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-8">
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-10 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight mb-2">
            Welcome to Snap Explorer
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg">
            Import your Snapchat "My Data" export to explore your chat history, media, and memories.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-10 space-y-8">
          {/* How-to guidance */}
          {!progress && !importResult && (
            <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900 rounded-2xl p-5 space-y-2">
              <h3 className="font-bold text-blue-800 dark:text-blue-300 text-sm">How to get your data</h3>
              <ol className="text-sm text-blue-700 dark:text-blue-400 space-y-1 list-decimal list-inside">
                <li>Go to <span className="font-mono font-bold">accounts.snapchat.com</span> and sign in</li>
                <li>Click "My Data" and submit a download request</li>
                <li>When ready, download the zip file</li>
                <li>Select the <span className="font-bold">.zip file directly</span> or unzip it and select the folder</li>
              </ol>
            </div>
          )}

          {progress && !isDone ? (
            <div className="space-y-6 py-8">
              <div className="flex justify-between items-end mb-2">
                <div>
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200">{progress.current_step}</h3>
                  <p className="text-slate-500 dark:text-slate-400">{progress.message}</p>
                </div>
                <span className="text-slate-400 font-mono font-bold">
                  {Math.round(progress.progress * 100)}%
                </span>
              </div>
              <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 transition-all duration-300 ease-out shadow-[0_0_15px_rgba(79,70,229,0.4)]"
                  style={{ width: `${progress.progress * 100}%` }}
                />
              </div>
              <p className="text-center text-sm text-slate-400 dark:text-slate-500 italic">
                This might take a while for large archives. We're indexing everything for instant access later.
              </p>
            </div>
          ) : isDone && importResult ? (
            <div className="space-y-6 py-4">
              <div className="text-center">
                <span className="text-5xl block mb-3">{importResult.errors.length > 0 ? "\u26A0\uFE0F" : "\u2705"}</span>
                <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100">
                  {importResult.errors.length > 0 ? "Import completed with errors" : "Import complete!"}
                </h3>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-center">
                  <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{importResult.conversations_parsed}</p>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Conversations</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-center">
                  <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{importResult.events_parsed.toLocaleString()}</p>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Messages</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-center">
                  <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{importResult.memories_parsed}</p>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Memories</p>
                </div>
              </div>

              {importResult.warnings.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-100 dark:border-amber-900 rounded-xl p-4">
                  <p className="font-bold text-amber-800 dark:text-amber-300 text-sm mb-2">
                    {importResult.warnings.length} warning(s)
                  </p>
                  <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1 max-h-32 overflow-y-auto">
                    {importResult.warnings.slice(0, 10).map((w, i) => (
                      <li key={i} className="truncate">{w}</li>
                    ))}
                    {importResult.warnings.length > 10 && (
                      <li className="italic">...and {importResult.warnings.length - 10} more</li>
                    )}
                  </ul>
                </div>
              )}

              {importResult.parse_failures > 0 && (
                <p className="text-sm text-slate-400 text-center">
                  {importResult.parse_failures} file(s) could not be parsed. Check the log for details.
                </p>
              )}

              <button
                onClick={onComplete}
                className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 dark:shadow-none active:scale-[0.98]"
              >
                Continue to Dashboard
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-50 dark:bg-red-950/50 border border-red-100 dark:border-red-900 text-red-600 dark:text-red-400 p-4 rounded-2xl flex items-start gap-3">
                  <span className="text-xl shrink-0 mt-0.5">{"\u26A0\uFE0F"}</span>
                  <p className="font-medium text-sm">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Detected Exports</h2>
                  <div className="flex gap-3">
                    <button
                      onClick={handlePickZip}
                      className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                    >
                      Select Zip File
                    </button>
                    <span className="text-slate-300 dark:text-slate-600">|</span>
                    <button
                      onClick={handlePickFolder}
                      className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                    >
                      Select Folder
                    </button>
                  </div>
                </div>

                {loading ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-4 text-slate-400">
                    <div className="w-8 h-8 border-4 border-slate-200 dark:border-slate-700 border-t-indigo-600 rounded-full animate-spin" />
                    <p className="font-medium">Scanning for data...</p>
                  </div>
                ) : detected.length > 0 ? (
                  <div className="grid gap-4">
                    {detected.map((exp) => (
                      <div
                        key={exp.source_path}
                        className="group bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 rounded-2xl hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-white dark:hover:bg-slate-700 transition-all flex items-center justify-between"
                      >
                        <div className="flex items-center gap-5">
                          <div className="w-14 h-14 bg-white dark:bg-slate-700 rounded-xl shadow-sm flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                            {exp.source_type === "Zip" ? "\u{1F4E6}" : "\u{1F4C2}"}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 dark:text-slate-100 text-lg truncate max-w-[250px]">
                              {exp.id}
                            </h4>
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-1 truncate max-w-[300px]">
                              {exp.source_path}
                            </p>
                            <div className="flex gap-2 mt-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                  exp.validation_status === "Valid"
                                    ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                                    : "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300"
                                }`}
                              >
                                {exp.validation_status}
                              </span>
                              <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-full text-[10px] font-black uppercase tracking-wider">
                                {exp.source_type}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleProcess(exp)}
                          className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 dark:shadow-none active:scale-95"
                        >
                          Import
                        </button>
                      </div>
                    ))}
                  </div>
                ) : !error ? (
                  <div className="py-12 text-center bg-slate-50 dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                    <p className="text-slate-400 dark:text-slate-500 font-medium">
                      No exports found automatically.
                    </p>
                    <div className="mt-4 flex gap-3 justify-center">
                      <button
                        onClick={handlePickZip}
                        className="bg-indigo-600 text-white border border-indigo-600 px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-sm transition-all"
                      >
                        Select Zip File
                      </button>
                      <button
                        onClick={handlePickFolder}
                        className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-6 py-2.5 rounded-xl font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 shadow-sm transition-all"
                      >
                        Select Folder
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>

        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-center">
          <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Your data stays local and is never uploaded.
          </p>
        </div>
      </div>
    </div>
  );
}
