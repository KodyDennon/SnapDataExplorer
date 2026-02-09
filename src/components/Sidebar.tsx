import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ExportSet } from "../types";

type Theme = "light" | "dark" | "system";

interface SidebarProps {
  onSelectExport: (exp: ExportSet) => void;
  onNavigate: (page: string) => void;
  onOpenSetup: () => void;
  onResetData: () => void;
  onReimport: () => void;
  activePage: string;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  refreshTrigger?: number;
}

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "\u{1F4CA}" },
  { id: "chats", label: "Chats", icon: "\u{1F4AC}" },
  { id: "search", label: "Search", icon: "\u{1F50D}" },
  { id: "gallery", label: "Gallery", icon: "\u{1F5BC}\uFE0F" },
];

const THEME_OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: "light", label: "Light", icon: "\u{2600}\uFE0F" },
  { value: "dark", label: "Dark", icon: "\u{1F319}" },
  { value: "system", label: "System", icon: "\u{1F4BB}" },
];

export function Sidebar({ onSelectExport, onNavigate, onOpenSetup, onResetData, onReimport, activePage, theme, onThemeChange, refreshTrigger }: SidebarProps) {
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
    <div className="w-72 bg-slate-900 text-slate-300 flex flex-col h-screen border-r border-slate-800">
      <div className="p-6">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center text-slate-900">{"\u{1F47B}"}</span>
          Snap Explorer
        </h1>
      </div>

      <nav className="flex-1 px-4 space-y-1" role="navigation" aria-label="Main navigation">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            aria-current={activePage === item.id ? "page" : undefined}
            className={`w-full text-left px-4 py-2 rounded-lg transition-colors flex items-center gap-3 ${
              activePage === item.id ? "bg-slate-800 text-white" : "hover:bg-slate-800"
            }`}
          >
            <span aria-hidden="true">{item.icon}</span> {item.label}
          </button>
        ))}
      </nav>

      <div className="px-4 pb-3">
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
          {THEME_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onThemeChange(opt.value)}
              className={`flex-1 text-center py-1.5 rounded-md text-[10px] font-bold transition-all ${
                theme === opt.value
                  ? "bg-slate-700 text-white"
                  : "text-slate-500 hover:text-slate-300"
              }`}
              title={opt.label}
              aria-label={`${opt.label} theme`}
              aria-pressed={theme === opt.value}
            >
              <span aria-hidden="true">{opt.icon}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center justify-between mb-4 px-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Archives</span>
          <button onClick={onOpenSetup} className="text-xs text-yellow-500 hover:text-yellow-400 font-bold">ADD +</button>
        </div>

        <div className="space-y-2 overflow-y-auto max-h-48">
          {exports.length === 0 && <p className="text-xs px-2 text-slate-600 italic">No archives loaded.</p>}
          {exports.map(exp => (
            <button
              key={exp.id}
              onClick={() => onSelectExport(exp)}
              className="w-full text-left p-2 rounded hover:bg-slate-800 group transition-all"
            >
              <p className="text-sm font-medium text-slate-300 group-hover:text-white truncate">{exp.id}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`w-2 h-2 rounded-full ${exp.validation_status === 'Valid' ? 'bg-green-500' : 'bg-orange-500'}`}></span>
                <span className="text-[10px] text-slate-500">{exp.validation_status}</span>
              </div>
            </button>
          ))}
        </div>

        {exports.length > 0 && (
          <div className="mt-3 space-y-1.5">
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
              className={`w-full text-xs font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                confirmReimport
                  ? "bg-yellow-500 text-slate-900 hover:bg-yellow-400"
                  : "text-slate-400 hover:text-yellow-400 hover:bg-slate-800"
              }`}
            >
              {confirmReimport ? "Click again to confirm" : "\u{1F504} Reimport Data"}
            </button>
            <button
              onClick={handleResetClick}
              className={`w-full text-xs font-bold py-2 rounded-lg transition-all ${
                confirmReset
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "text-slate-500 hover:text-red-400 hover:bg-slate-800"
              }`}
            >
              {confirmReset ? "Click again to confirm reset" : "Reset All Data"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
