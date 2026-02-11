import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ExportSet } from "../types";
import { cn } from "../lib/utils";
import { ModeToggle, ViewMode } from "./ui/ModeToggle";
import { motion } from "framer-motion";
import { 
  LayoutDashboard, 
  MessageSquare, 
  Search, 
  Image as ImageIcon, 
  Cloud, 
  Info,
  Plus,
  RefreshCcw,
  Trash2,
  Database
} from "lucide-react";

type Theme = "light" | "dark" | "system";

interface SidebarProps {
  onSelectExport: (exp: ExportSet) => void;
  onNavigate: (page: string) => void;
  onOpenSetup: () => void;
  onOpenAbout: () => void;
  onResetData: () => void;
  onReimport: () => void;
  activePage: string;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  refreshTrigger?: number;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
  { id: "chats", label: "Conversations", icon: <MessageSquare className="w-5 h-5" /> },
  { id: "search", label: "Search", icon: <Search className="w-5 h-5" /> },
  { id: "gallery", label: "Gallery", icon: <ImageIcon className="w-5 h-5" /> },
  { id: "memories", label: "Memories", icon: <Cloud className="w-5 h-5" /> },
];

const THEME_OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] = [
  {
    value: "light", label: "Light", icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    )
  },
  {
    value: "dark", label: "Dark", icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    )
  },
  {
    value: "system", label: "System", icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    )
  },
];

export function Sidebar({
  onSelectExport,
  onNavigate,
  onOpenSetup,
  onOpenAbout,
  onResetData,
  onReimport,
  activePage,
  theme,
  onThemeChange,
  refreshTrigger,
  viewMode,
  onViewModeChange,
}: SidebarProps) {
  const [exports, setExports] = useState<ExportSet[]>([]);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmReimport, setConfirmReimport] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reimportTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      if (reimportTimerRef.current) clearTimeout(reimportTimerRef.current);
    };
  }, []);

  async function loadExports() {
    try {
      const results = await invoke<ExportSet[]>("get_exports");
      setExports(results);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    loadExports();
  }, [activePage, refreshTrigger]);

  function handleResetClick() {
    if (confirmReset) {
      onResetData();
      setConfirmReset(false);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    } else {
      setConfirmReset(true);
      resetTimerRef.current = setTimeout(() => setConfirmReset(false), 3000);
    }
  }

  return (
    <div className="w-72 bg-surface-50 dark:bg-surface-900 text-surface-600 dark:text-surface-300 flex flex-col h-screen border-r border-surface-200 dark:border-surface-800 shadow-xl">
      {/* Logo & Branding */}
      <div className="p-5 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.div 
            whileHover={{ rotate: 10, scale: 1.05 }}
            className="w-10 h-10 rounded-xl bg-linear-to-br from-brand-500 to-accent-purple flex items-center justify-center shadow-lg shadow-brand-500/25 overflow-hidden"
          >
            <img
              src="/logo.png"
              alt="Snap Explorer"
              className="w-8 h-8 object-contain drop-shadow-lg"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = '<span class="text-xl">📊</span>';
              }}
            />
          </motion.div>
          <div>
            <h1 className="text-base font-bold text-surface-900 dark:text-white">Snap Explorer</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-brand-500">Forensics</p>
          </div>
        </div>
        <button 
          onClick={onOpenAbout}
          className="p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-400 hover:text-brand-500 transition-all group"
          title="About & Updates"
        >
          <Info className="w-5 h-5 group-hover:scale-110 transition-transform" />
        </button>
      </div>

      {/* Mode Toggle */}
      <div className="px-4 py-4">
        <ModeToggle mode={viewMode} onModeChange={onViewModeChange} className="w-full" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar" role="navigation" aria-label="Main navigation">
        <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-surface-400">Navigation</p>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            aria-current={activePage === item.id ? "page" : undefined}
            className={cn(
              "w-full text-left px-3 py-2.5 rounded-xl transition-all duration-200 flex items-center gap-3 font-medium relative group",
              activePage === item.id
                ? "bg-brand-600 text-white shadow-lg shadow-brand-600/25"
                : "hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-600 dark:text-surface-400"
            )}
          >
            <span className={cn(
              "transition-colors",
              activePage === item.id ? "text-white" : "text-surface-400 group-hover:text-brand-500"
            )}>
              {item.icon}
            </span>
            {item.label}
            {activePage === item.id && (
              <motion.div 
                layoutId="nav-pill"
                className="absolute left-1 w-1 h-5 bg-white rounded-full"
              />
            )}
          </button>
        ))}
      </nav>

      {/* Theme Switcher */}
      <div className="px-4 py-3 border-t border-surface-200 dark:border-surface-800">
        <div className="flex items-center gap-1 bg-surface-100 dark:bg-surface-800 rounded-xl p-1">
          {THEME_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onThemeChange(opt.value)}
              className={cn(
                "flex-1 flex items-center justify-center py-2 rounded-lg text-xs font-medium transition-all",
                theme === opt.value
                  ? "bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-xs"
                  : "text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
              )}
              title={opt.label}
              aria-label={`${opt.label} theme`}
              aria-pressed={theme === opt.value}
            >
              {opt.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Archives Section */}
      <div className="p-4 border-t border-surface-200 dark:border-surface-800 bg-surface-100/30 dark:bg-surface-950/30">
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-surface-400">Archives</span>
          <button
            onClick={onOpenSetup}
            className="p-1 rounded-md hover:bg-brand-500/10 text-brand-600 hover:text-brand-500 transition-all flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1.5 overflow-y-auto max-h-32 custom-scrollbar">
          {exports.length === 0 && (
            <p className="text-xs px-2 py-4 text-center text-surface-400 italic">No archives imported yet.</p>
          )}
          {exports.map(exp => (
            <button
              key={exp.id}
              onClick={() => onSelectExport(exp)}
              className="w-full text-left p-2.5 rounded-xl hover:bg-white dark:hover:bg-surface-800 group transition-all border border-transparent hover:border-surface-200 dark:hover:border-surface-700 shadow-xs hover:shadow-md"
            >
              <div className="flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-surface-400 group-hover:text-brand-500 transition-colors" />
                <p className="text-sm font-medium text-surface-700 dark:text-surface-200 group-hover:text-surface-900 dark:group-hover:text-white truncate">
                  {exp.id}
                </p>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  exp.validation_status === 'Valid' ? 'bg-green-500' : 'bg-amber-500'
                )} />
                <span className="text-[10px] text-surface-400">{exp.validation_status}</span>
              </div>
            </button>
          ))}
        </div>

        {exports.length > 0 && (
          <div className="mt-3 pt-3 border-t border-surface-200 dark:border-surface-700 space-y-1.5">
            <button
              onClick={() => {
                if (confirmReimport) {
                  onReimport();
                  setConfirmReimport(false);
                  if (reimportTimerRef.current) clearTimeout(reimportTimerRef.current);
                } else {
                  setConfirmReimport(true);
                  reimportTimerRef.current = setTimeout(() => setConfirmReimport(false), 3000);
                }
              }}
              className={cn(
                "w-full text-xs font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 uppercase tracking-tighter",
                confirmReimport
                  ? "bg-amber-500 text-white animate-pulse"
                  : "text-surface-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
              )}
            >
              {confirmReimport ? "Confirm?" : <><RefreshCcw className="w-3 h-3" /> Reimport</>}
            </button>
            <button
              onClick={handleResetClick}
              className={cn(
                "w-full text-xs font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 uppercase tracking-tighter",
                confirmReset
                  ? "bg-red-600 text-white"
                  : "text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
              )}
            >
              {confirmReset ? "Confirm Reset?" : <><Trash2 className="w-3 h-3" /> Reset Data</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
