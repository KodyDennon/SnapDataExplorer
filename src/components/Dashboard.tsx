import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ExportSet, ExportStats, IngestionProgress, ValidationReport } from "../types";
import { Card, Badge, Button } from "./ui";
import { cn } from "../lib/utils";
import { ViewMode } from "./ui/ModeToggle";
import { DashboardSkeleton } from "./ui/Skeleton";
import { 
  BarChart3, 
  Users, 
  Image as ImageIcon, 
  Calendar, 
  Search, 
  Zap, 
  History,
  ShieldCheck,
  AlertTriangle
} from "lucide-react";
import { motion } from "framer-motion";

interface DashboardProps {
  currentExport: ExportSet | null;
  progress: IngestionProgress | null;
  viewMode: ViewMode;
}

export function Dashboard({ currentExport, progress, viewMode }: DashboardProps) {
  const [stats, setStats] = useState<ExportStats | null>(null);
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentExport && !progress) {
      setLoading(true);
      Promise.all([
        invoke<ExportStats | null>("get_export_stats"),
        invoke<ValidationReport | null>("get_validation_report")
      ]).then(([s, v]) => {
        setStats(s);
        setValidation(v);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [currentExport, progress]);

  // Filter out the export owner from top contacts
  const filteredTopContacts = useMemo(() => {
    if (!stats || stats.top_contacts.length === 0) return [];
    const ownerUsername = stats.top_contacts[0][0];
    return stats.top_contacts.filter(([name]) => name !== ownerUsername);
  }, [stats]);

  if (loading && currentExport && !progress) {
    return (
      <div className="flex-1 p-8 lg:p-12 overflow-y-auto bg-surface-50 dark:bg-surface-950">
        <DashboardSkeleton />
      </div>
    );
  }

  // Chill Mode: Simplified, visually focused dashboard
  if (viewMode === "chill") {
    return (
      <div className="flex-1 p-8 overflow-y-auto bg-linear-to-br from-surface-900 via-surface-950 to-brand-950">
        <header className="mb-8 text-center">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-bold mb-2 text-white"
          >
            Your Memories
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-surface-400"
          >
            A glimpse into your Snapchat journey
          </motion.p>
        </header>

        {progress && <ProgressCard progress={progress} />}

        {!currentExport && !progress && <EmptyState />}

        {stats && !progress && (
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Hero Stats */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <ChillStatCard value={stats.total_messages.toLocaleString()} label="Messages" icon="💬" delay={0.1} />
              <ChillStatCard value={stats.total_conversations.toString()} label="Friends" icon="👥" delay={0.2} />
              <ChillStatCard value={stats.total_memories.toString()} label="Memories" icon="📸" delay={0.3} />
            </div>

            {/* Journey Timeline */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
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
            </motion.div>

            {/* Top Friends */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
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
            </motion.div>
          </div>
        )}
        <AIAttribution />
      </div>
    );
  }

  // Pro Mode: Data-heavy, forensic dashboard
  return (
    <div className="flex-1 p-8 lg:p-12 overflow-y-auto custom-scrollbar bg-surface-50 dark:bg-surface-950">
      <header className="mb-10 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight text-surface-900 dark:text-white">Archive Intelligence</h1>
            <Badge variant="info" size="sm">FORENSIC</Badge>
          </div>
          <p className="text-surface-500 dark:text-surface-400 text-lg">Deep analysis and data reconstruction of your Snapchat export.</p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Search className="w-4 h-4" />
            Global Search
          </Button>
          <Button className="gap-2 bg-brand-600 hover:bg-brand-500">
            <Zap className="w-4 h-4" />
            Quick Export
          </Button>
        </div>
      </header>

      {progress && <ProgressCard progress={progress} />}

      {!currentExport && !progress && <EmptyState />}

      {stats && !progress && (
        <div className="space-y-8">
          {/* Primary Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard 
              label="Total Messages" 
              value={stats.total_messages.toLocaleString()} 
              icon={<BarChart3 className="w-4 h-4 text-brand-500" />} 
            />
            <StatCard 
              label="Conversations" 
              value={stats.total_conversations.toString()} 
              icon={<Users className="w-4 h-4 text-accent-purple" />} 
            />
            <StatCard 
              label="Memories" 
              value={stats.total_memories.toString()} 
              icon={<ImageIcon className="w-4 h-4 text-accent-pink" />} 
            />
            <StatCard 
              label="Date Range" 
              icon={<Calendar className="w-4 h-4 text-accent-cyan" />}
            >
              <p className="text-lg font-bold text-surface-900 dark:text-white mt-2">
                {stats.start_date ? new Date(stats.start_date).toLocaleDateString() : "N/A"}
                <span className="mx-2 text-surface-300 dark:text-surface-600">→</span>
                {stats.end_date ? new Date(stats.end_date).toLocaleDateString() : "N/A"}
              </p>
            </StatCard>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Card variant="surface" className="flex items-center gap-4 p-5 hover:border-brand-500/50 cursor-pointer group transition-all">
              <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-500 group-hover:bg-brand-500 group-hover:text-white transition-all">
                <History className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-surface-900 dark:text-white">Recent Chats</h4>
                <p className="text-xs text-surface-500">Jump back into conversations</p>
              </div>
            </Card>
            <Card variant="surface" className="flex items-center gap-4 p-5 hover:border-accent-purple/50 cursor-pointer group transition-all">
              <div className="w-12 h-12 rounded-xl bg-accent-purple/10 flex items-center justify-center text-accent-purple group-hover:bg-accent-purple group-hover:text-white transition-all">
                <ImageIcon className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-surface-900 dark:text-white">Media Gallery</h4>
                <p className="text-xs text-surface-500">Browse all visual assets</p>
              </div>
            </Card>
            <Card variant="surface" className="flex items-center gap-4 p-5 hover:border-accent-cyan/50 cursor-pointer group transition-all">
              <div className="w-12 h-12 rounded-xl bg-accent-cyan/10 flex items-center justify-center text-accent-cyan group-hover:bg-accent-cyan group-hover:text-white transition-all">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-surface-900 dark:text-white">Data Integrity</h4>
                <p className="text-xs text-surface-500">Verify your archive health</p>
              </div>
            </Card>
          </div>

          {/* Detailed Analysis Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Contacts */}
            <Card variant="surface" padding="lg" className="border-t-4 border-t-brand-500">
              <h3 className="text-lg font-bold mb-5 flex items-center gap-2 text-surface-900 dark:text-white">
                <Users className="w-5 h-5 text-brand-500" />
                Message Frequency by Contact
              </h3>
              <div className="space-y-4">
                {filteredTopContacts.slice(0, 8).map(([name, count], i) => (
                  <div key={name} className="flex items-center gap-4">
                    <span className="w-6 text-surface-400 font-mono text-sm">{String(i + 1).padStart(2, '0')}</span>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1.5">
                        <span className="font-semibold text-surface-800 dark:text-surface-200">{name}</span>
                        <span className="text-surface-400 text-sm font-mono">{count.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-surface-100 dark:bg-surface-800 rounded-full h-1.5 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(count / (filteredTopContacts[0]?.[1] || 1)) * 100}%` }}
                          transition={{ duration: 1, ease: "easeOut", delay: i * 0.1 }}
                          className="bg-linear-to-r from-brand-500 to-accent-purple h-full rounded-full"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Data Integrity */}
            {validation && (
              <Card variant="surface" padding="lg" className="border-t-4 border-t-accent-cyan">
                <h3 className="text-lg font-bold mb-5 flex items-center gap-2 text-surface-900 dark:text-white">
                  <ShieldCheck className="w-5 h-5 text-accent-cyan" />
                  Data Integrity Report
                </h3>
                <div className="space-y-4">
                  <IntegrityRow label="HTML Files Parsed" value={validation.parsed_html_files} total={validation.total_html_files} />
                  <IntegrityRow label="Media Files Resolved" value={validation.media_found} total={validation.total_media_referenced} />

                  {validation.warnings.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider flex items-center gap-2">
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                        Warnings
                      </p>
                      <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-2">
                        {validation.warnings.map((w, i) => (
                          <div key={i} className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-500/10 p-3 rounded-xl border border-amber-200 dark:border-amber-500/20">
                            {w}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-500/10 p-3 rounded-xl border border-green-200 dark:border-green-500/20 mt-4">
                      <ShieldCheck className="w-4 h-4" />
                      <span className="font-semibold">All integrity checks passed</span>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
      <AIAttribution />
    </div>
  );
}

// --- Supporting Components ---

function AIAttribution() {
  return (
    <div className="mt-16 pt-8 border-t border-surface-200 dark:border-surface-800 text-center opacity-60 hover:opacity-100 transition-opacity pb-8">
      <p className="text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-widest mb-4">
        Developed 100% by AI
      </p>
      <div className="flex flex-wrap justify-center gap-3 text-[10px] font-bold text-surface-600 dark:text-surface-400">
        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-surface-900 rounded-full border border-surface-200 dark:border-surface-800 shadow-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" /> CLAUDE 4.5
        </span>
        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-surface-900 rounded-full border border-surface-200 dark:border-surface-800 shadow-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> GEMINI 3
        </span>
      </div>
    </div>
  );
}

function ProgressCard({ progress }: { progress: IngestionProgress }) {
  return (
    <Card variant="elevated" padding="lg" className="bg-surface-900 text-white mb-8 overflow-hidden relative">
      <div className="flex justify-between items-center mb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center animate-pulse">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
          <h3 className="text-lg font-bold">{progress.current_step}</h3>
        </div>
        <span className="text-xl font-mono text-brand-400">{(progress.progress * 100).toFixed(0)}%</span>
      </div>
      <div className="w-full bg-surface-800 rounded-full h-3 mb-4 overflow-hidden relative z-10">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress.progress * 100}%` }}
          className="bg-linear-to-r from-brand-500 to-accent-cyan h-full rounded-full transition-all duration-700 ease-out"
        />
      </div>
      <p className="text-surface-400 relative z-10">{progress.message}</p>
      
      {/* Decorative background pulse */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 blur-3xl -mr-32 -mt-32 rounded-full animate-pulse" />
    </Card>
  );
}

function Loader2({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function EmptyState() {
  return (
    <div className="max-w-xl mx-auto mt-16 text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="w-28 h-28 bg-surface-100 dark:bg-surface-800 rounded-3xl flex items-center justify-center shadow-lg mx-auto mb-8 border border-surface-200 dark:border-surface-700">
        <span className="text-5xl">🧠</span>
      </div>
      <h2 className="text-2xl font-bold text-surface-800 dark:text-white mb-3">No Archive Loaded</h2>
      <p className="text-surface-500 dark:text-surface-400 text-lg mb-8 leading-relaxed">
        Connect your Snapchat "My Data" export to unlock insights, reconstruct chats, and search your entire history.
      </p>
      <div className="flex justify-center gap-6 text-sm font-semibold text-surface-400">
        <span className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-green-500" />
          Privacy First
        </span>
        <span className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-brand-500" />
          Local Only
        </span>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, children }: {
  label: string;
  value?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <Card variant="surface" padding="lg" className="hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <span className="text-surface-400 font-semibold text-xs uppercase tracking-wider">{label}</span>
        {icon}
      </div>
      {value && <p className="text-4xl font-black text-surface-900 dark:text-white mt-2">{value}</p>}
      {children}
    </Card>
  );
}

function ChillStatCard({ value, label, icon, delay = 0 }: { value: string; label: string; icon: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay }}
    >
      <Card variant="glass" padding="md" className="text-center">
        <span className="text-3xl mb-1 block">{icon}</span>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-surface-400 text-xs">{label}</p>
      </Card>
    </motion.div>
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
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className={cn(
            "h-full rounded-full",
            pct === 100 ? "bg-green-500" : pct > 80 ? "bg-amber-500" : "bg-red-500"
          )}
        />
      </div>
    </div>
  );
}
