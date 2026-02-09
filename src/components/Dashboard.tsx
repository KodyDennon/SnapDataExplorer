import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ExportSet, ExportStats, IngestionProgress, ValidationReport } from "../types";
import { Card, Badge } from "./ui";
import { cn } from "../lib/utils";
import { ViewMode } from "./ui/ModeToggle";
import { ChillView } from "./ChillView";

interface DashboardProps {
  currentExport: ExportSet | null;
  progress: IngestionProgress | null;
  viewMode: ViewMode;
}

export function Dashboard({ currentExport, progress, viewMode }: DashboardProps) {
  const [stats, setStats] = useState<ExportStats | null>(null);
  const [validation, setValidation] = useState<ValidationReport | null>(null);

  useEffect(() => {
    if (currentExport && !progress) {
      invoke<ExportStats | null>("get_export_stats").then(setStats);
      invoke<ValidationReport | null>("get_validation_report").then(setValidation);
    }
  }, [currentExport, progress]);

  // Filter out the export owner from top contacts
  // The owner is typically the person with the most messages (appears in all conversations)
  const filteredTopContacts = useMemo(() => {
    if (!stats || stats.top_contacts.length === 0) return [];

    // Get the owner username - it's the one with the most messages
    const ownerUsername = stats.top_contacts[0][0];

    // Filter out the owner and return the rest
    return stats.top_contacts.filter(([name]) => name !== ownerUsername);
  }, [stats]);

  // Chill Mode: Simplified, visually focused dashboard
  if (viewMode === "chill") {
    return (
      <div className="flex-1 p-8 overflow-y-auto bg-gradient-to-br from-surface-900 via-surface-950 to-brand-950">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2 text-white">Your Memories</h1>
          <p className="text-surface-400">A glimpse into your Snapchat journey</p>
        </header>

        {progress && <ProgressCard progress={progress} />}

        {!currentExport && !progress && <EmptyState />}

        {stats && !progress && (
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Hero Stats */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <ChillStatCard value={stats.total_messages.toLocaleString()} label="Messages" icon="💬" />
              <ChillStatCard value={stats.total_conversations.toString()} label="Friends" icon="👥" />
              <ChillStatCard value={stats.total_memories.toString()} label="Memories" icon="📸" />
            </div>

            {/* Journey Timeline */}
            <Card variant="glass" padding="lg" className="text-center">
              <p className="text-surface-400 text-sm mb-2">Your Snapchat Journey</p>
              <p className="text-2xl font-bold text-white">
                {stats.start_date && stats.end_date ? (
                  <>
                    {new Date(stats.start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    <span className="text-brand-400 mx-3">→</span>
                    {new Date(stats.end_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </>
                ) : "Timeline Unknown"}
              </p>
              {stats.start_date && stats.end_date && (
                <p className="text-surface-500 text-sm mt-2">
                  {Math.round((new Date(stats.end_date).getTime() - new Date(stats.start_date).getTime()) / (1000 * 60 * 60 * 24 * 365))} years of memories
                </p>
              )}
            </Card>

            {/* Top Friends */}
            <Card variant="glass" padding="lg">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span>🏆</span> Your Closest Friends
              </h3>
              <div className="space-y-3">
                {filteredTopContacts.slice(0, 5).map(([name, count], i) => (
                  <div key={name} className="flex items-center gap-3">
                    <span className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                      i === 0 ? "bg-yellow-500 text-yellow-900" :
                        i === 1 ? "bg-surface-400 text-surface-900" :
                          i === 2 ? "bg-amber-700 text-amber-100" :
                            "bg-surface-700 text-surface-300"
                    )}>
                      {i + 1}
                    </span>
                    <span className="flex-1 font-medium text-surface-200">{name}</span>
                    <span className="text-surface-500 text-sm">{count} msgs</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    );
  }

  // Pro Mode: Data-heavy, forensic dashboard
  return (
    <div className="flex-1 p-8 lg:p-12 overflow-y-auto custom-scrollbar bg-surface-50 dark:bg-surface-950">
      <header className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold tracking-tight text-surface-900 dark:text-white">Archive Intelligence</h1>
          <Badge variant="info" size="sm">FORENSIC</Badge>
        </div>
        <p className="text-surface-500 dark:text-surface-400 text-lg">Deep analysis and data reconstruction of your Snapchat export.</p>
      </header>

      {progress && <ProgressCard progress={progress} />}

      {!currentExport && !progress && <EmptyState />}

      {stats && !progress && (
        <div className="space-y-8">
          {/* Primary Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard label="Total Messages" value={stats.total_messages.toLocaleString()} trend="+12%" />
            <StatCard label="Conversations" value={stats.total_conversations.toString()} />
            <StatCard label="Memories" value={stats.total_memories.toString()} />
            <StatCard label="Date Range">
              <p className="text-lg font-bold text-surface-900 dark:text-white mt-2">
                {stats.start_date ? new Date(stats.start_date).toLocaleDateString() : "N/A"}
                <span className="mx-2 text-surface-300 dark:text-surface-600">→</span>
                {stats.end_date ? new Date(stats.end_date).toLocaleDateString() : "N/A"}
              </p>
            </StatCard>
          </div>

          {/* Media Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <StatCard label="Linked Media Files" value={stats.total_media_files.toString()}>
              {stats.total_media_files > 0 && (
                <Badge variant="success" size="sm" className="mt-2">Ready for Gallery</Badge>
              )}
            </StatCard>
            <StatCard label="Missing Media" value={stats.missing_media_count.toString()}>
              {stats.missing_media_count > 0 && (
                <p className="text-xs text-amber-500 mt-2 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {stats.missing_media_count} events without linked files
                </p>
              )}
            </StatCard>
          </div>

          {/* Detailed Analysis Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Contacts */}
            <Card variant="surface" padding="lg">
              <h3 className="text-lg font-bold mb-5 flex items-center gap-2 text-surface-900 dark:text-white">
                <svg className="w-5 h-5 text-accent-pink" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                </svg>
                Message Frequency by Contact
              </h3>
              <div className="space-y-4">
                {filteredTopContacts.map(([name, count], i) => (
                  <div key={name} className="flex items-center gap-4">
                    <span className="w-6 text-surface-400 font-mono text-sm">{String(i + 1).padStart(2, '0')}</span>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1.5">
                        <span className="font-semibold text-surface-800 dark:text-surface-200">{name}</span>
                        <span className="text-surface-400 text-sm font-mono">{count.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-surface-100 dark:bg-surface-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-brand-500 to-accent-purple h-full rounded-full transition-all duration-1000"
                          style={{ width: `${(count / (filteredTopContacts[0]?.[1] || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Data Integrity */}
            {validation && (
              <Card variant="surface" padding="lg">
                <h3 className="text-lg font-bold mb-5 flex items-center gap-2 text-surface-900 dark:text-white">
                  <svg className="w-5 h-5 text-accent-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Data Integrity Report
                </h3>
                <div className="space-y-4">
                  <IntegrityRow label="HTML Files Parsed" value={validation.parsed_html_files} total={validation.total_html_files} />
                  <IntegrityRow label="Media Files Resolved" value={validation.media_found} total={validation.total_media_referenced} />

                  {validation.warnings.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Warnings</p>
                      {validation.warnings.map((w, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-500/10 p-3 rounded-xl border border-amber-200 dark:border-amber-500/20">
                          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-500/10 p-3 rounded-xl border border-green-200 dark:border-green-500/20 mt-4">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="font-semibold">All integrity checks passed</span>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>

          {/* Summary Banner */}
          <Card variant="elevated" padding="lg" className="bg-gradient-to-br from-brand-600 to-accent-purple text-white">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-2xl">
                📊
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-2">Archive Summary</h3>
                <p className="text-white/80 leading-relaxed">
                  Your archive spans{" "}
                  <span className="font-semibold text-white">
                    {stats.start_date && stats.end_date
                      ? `${Math.round((new Date(stats.end_date).getTime() - new Date(stats.start_date).getTime()) / (1000 * 60 * 60 * 24 * 365))} years`
                      : "an unknown period"}
                  </span>
                  {" "}containing{" "}
                  <span className="font-semibold text-white">{stats.total_conversations} conversations</span>,{" "}
                  <span className="font-semibold text-white">{stats.total_messages.toLocaleString()} messages</span>, and{" "}
                  <span className="font-semibold text-white">{stats.total_memories} memories</span>.
                </p>
                <div className="mt-4 flex items-center gap-2 text-sm bg-white/10 rounded-xl px-4 py-2 inline-flex">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Full-text search is active across all indexed content.
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// --- Supporting Components ---

function ProgressCard({ progress }: { progress: IngestionProgress }) {
  return (
    <Card variant="elevated" padding="lg" className="bg-surface-900 text-white mb-8">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center animate-pulse">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold">{progress.current_step}</h3>
        </div>
        <span className="text-xl font-mono text-brand-400">{(progress.progress * 100).toFixed(0)}%</span>
      </div>
      <div className="w-full bg-surface-800 rounded-full h-3 mb-4 overflow-hidden">
        <div
          className="bg-gradient-to-r from-brand-500 to-accent-cyan h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${progress.progress * 100}%` }}
        />
      </div>
      <p className="text-surface-400">{progress.message}</p>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="max-w-xl mx-auto mt-16 text-center">
      <div className="w-28 h-28 bg-surface-100 dark:bg-surface-800 rounded-3xl flex items-center justify-center shadow-lg mx-auto mb-8 border border-surface-200 dark:border-surface-700">
        <span className="text-5xl">🧠</span>
      </div>
      <h2 className="text-2xl font-bold text-surface-800 dark:text-white mb-3">No Archive Loaded</h2>
      <p className="text-surface-500 dark:text-surface-400 text-lg mb-8 leading-relaxed">
        Connect your Snapchat "My Data" export to unlock insights, reconstruct chats, and search your entire history.
      </p>
      <div className="flex justify-center gap-6 text-sm font-semibold text-surface-400">
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Privacy First
        </span>
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Local Only
        </span>
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Media Recovery
        </span>
      </div>
    </div>
  );
}

function StatCard({ label, value, trend, children }: {
  label: string;
  value?: string;
  trend?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card variant="surface" padding="lg">
      <div className="flex items-start justify-between">
        <span className="text-surface-400 font-semibold text-xs uppercase tracking-wider">{label}</span>
        {trend && (
          <span className="text-xs font-bold text-green-500 bg-green-50 dark:bg-green-500/10 px-2 py-0.5 rounded-full">
            {trend}
          </span>
        )}
      </div>
      {value && <p className="text-4xl font-black text-surface-900 dark:text-white mt-2">{value}</p>}
      {children}
    </Card>
  );
}

function ChillStatCard({ value, label, icon }: { value: string; label: string; icon: string }) {
  return (
    <Card variant="glass" padding="md" className="text-center">
      <span className="text-3xl mb-1 block">{icon}</span>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-surface-400 text-xs">{label}</p>
    </Card>
  );
}

function IntegrityRow({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? (value / total) * 100 : 100;
  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <span className="text-sm font-medium text-surface-700 dark:text-surface-300">{label}</span>
        <span className="text-sm text-surface-400 font-mono">{value}/{total}</span>
      </div>
      <div className="w-full bg-surface-100 dark:bg-surface-800 rounded-full h-2 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-1000",
            pct === 100 ? "bg-green-500" : pct > 80 ? "bg-amber-500" : "bg-red-500"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
