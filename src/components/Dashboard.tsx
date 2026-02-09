import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ExportSet, ExportStats, IngestionProgress, ValidationReport } from "../types";

export function Dashboard({ currentExport, progress }: { currentExport: ExportSet | null; progress: IngestionProgress | null }) {
  const [stats, setStats] = useState<ExportStats | null>(null);
  const [validation, setValidation] = useState<ValidationReport | null>(null);

  useEffect(() => {
    if (currentExport && !progress) {
      invoke<ExportStats | null>("get_export_stats").then(setStats);
      invoke<ValidationReport | null>("get_validation_report").then(setValidation);
    }
  }, [currentExport, progress]);

  return (
    <div className="flex-1 p-12 overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <header className="mb-12">
        <h1 className="text-4xl font-bold mb-2 tracking-tight text-slate-900 dark:text-slate-100">Archive Intelligence</h1>
        <p className="text-slate-500 dark:text-slate-400 text-lg">Insights and automated analysis of your Snapchat data.</p>
      </header>

      {progress && (
        <div className="bg-slate-900 text-white p-10 rounded-[2.5rem] shadow-2xl mb-12 border border-slate-800">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center text-slate-900 font-bold animate-pulse">
                {"\u{2699}\uFE0F"}
              </div>
              <h3 className="text-xl font-bold">{progress.current_step}</h3>
            </div>
            <span className="text-xl font-mono text-yellow-400">{(progress.progress * 100).toFixed(0)}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-4 mb-6 overflow-hidden p-1">
            <div
              className="bg-yellow-400 h-full rounded-full transition-all duration-700 ease-in-out shadow-[0_0_20px_rgba(250,204,21,0.6)]"
              style={{ width: `${progress.progress * 100}%` }}
            ></div>
          </div>
          <p className="text-slate-400 text-lg italic">{progress.message}</p>
        </div>
      )}

      {!currentExport && !progress && (
        <div className="max-w-2xl mx-auto mt-20 text-center">
          <div className="w-32 h-32 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-xl mx-auto mb-8 border border-slate-100 dark:border-slate-700">
            <span className="text-6xl">{"\u{1F9E0}"}</span>
          </div>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-4">No Archive Indexed</h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg mb-8 leading-relaxed">
            Connect your Snapchat "My Data" export to unlock deep insights, reconstructed chat threads, and semantic search across your entire history.
          </p>
          <div className="flex justify-center gap-4 text-sm font-bold text-slate-400">
            <span className="flex items-center gap-2">{"\u{2713}"} Privacy First</span>
            <span className="flex items-center gap-2">{"\u{2713}"} Local Analysis</span>
            <span className="flex items-center gap-2">{"\u{2713}"} Media Recovery</span>
          </div>
        </div>
      )}

      {stats && !progress && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard label="Total Messages" value={stats.total_messages.toLocaleString()} />
            <StatCard label="Conversations" value={stats.total_conversations.toString()} />
            <StatCard label="Memories" value={stats.total_memories.toString()} />
            <StatCard label="Date Range" large={false}>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-2">
                {stats.start_date ? new Date(stats.start_date).toLocaleDateString() : "???"}
                <span className="mx-2 text-slate-300 dark:text-slate-600">{"\u{2192}"}</span>
                {stats.end_date ? new Date(stats.end_date).toLocaleDateString() : "???"}
              </p>
            </StatCard>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <StatCard label="Linked Media" value={stats.total_media_files.toString()} />
            <StatCard label="Missing Media" value={stats.missing_media_count.toString()}>
              {stats.missing_media_count > 0 && stats.total_media_files === 0 && (
                <p className="text-xs text-amber-500 mt-1">
                  Your export does not include media files. Re-download from Snapchat with "Include Media" enabled.
                </p>
              )}
              {stats.missing_media_count > 0 && stats.total_media_files > 0 && (
                <p className="text-xs text-amber-500 mt-1">
                  {stats.missing_media_count} media events could not be linked to files
                </p>
              )}
            </StatCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-700">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <span className="text-2xl">{"\u{1F525}"}</span> Top Contacts
              </h3>
              <div className="space-y-4">
                {stats.top_contacts.map(([name, count], i) => (
                  <div key={name} className="flex items-center gap-4">
                    <span className="w-6 text-slate-300 dark:text-slate-600 font-black text-lg">{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{name}</span>
                        <span className="text-slate-400 text-sm font-mono">{count} msgs</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-slate-800 dark:bg-yellow-400 h-full rounded-full transition-all duration-1000"
                          style={{ width: `${(count / stats.top_contacts[0][1]) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {validation && (
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-700">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <span className="text-2xl">{"\u{1F6E1}\uFE0F"}</span> Data Integrity
                </h3>
                <div className="space-y-4">
                  <IntegrityRow label="Conversations Parsed" value={validation.parsed_html_files} total={validation.total_html_files} />
                  <IntegrityRow label="Media Resolved" value={validation.media_found} total={validation.total_media_referenced} />
                  {validation.warnings.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Warnings</p>
                      {validation.warnings.map((w, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl">
                          <span>{"\u{26A0}\uFE0F"}</span>
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {validation.warnings.length === 0 && (
                    <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-900/20 p-3 rounded-xl mt-4">
                      <span>{"\u{2705}"}</span>
                      <span className="font-bold">All data integrity checks passed</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="bg-indigo-900 text-indigo-100 p-8 rounded-[2rem] shadow-xl overflow-hidden relative">
            <div className="relative z-10">
              <h3 className="text-xl font-bold mb-4">Archive Analysis</h3>
              <p className="text-indigo-200 leading-relaxed mb-6">
                Your archive spans{" "}
                {stats.start_date && stats.end_date
                  ? `${Math.round((new Date(stats.end_date).getTime() - new Date(stats.start_date).getTime()) / (1000 * 60 * 60 * 24 * 365))} years`
                  : "an unknown period"}
                {" "}with {stats.total_conversations} conversations,{" "}
                {stats.total_messages.toLocaleString()} messages, and {stats.total_memories} saved memories.
              </p>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                <p className="text-sm font-medium">
                  {"\u{2728}"} Full-text search is active. Use the Search tab to find any message instantly.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, large = true, children }: {
  label: string;
  value?: string;
  large?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
      <span className="text-slate-400 font-bold text-xs uppercase tracking-tighter block mb-2">{label}</span>
      {value && <p className={`font-black text-slate-900 dark:text-slate-100 ${large ? "text-5xl" : "text-2xl"}`}>{value}</p>}
      {children}
    </div>
  );
}

function IntegrityRow({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? (value / total) * 100 : 100;
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
        <span className="text-sm text-slate-400 font-mono">{value}/{total}</span>
      </div>
      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${pct === 100 ? "bg-green-500" : pct > 80 ? "bg-yellow-500" : "bg-red-500"}`}
          style={{ width: `${pct}%` }}
        ></div>
      </div>
    </div>
  );
}
