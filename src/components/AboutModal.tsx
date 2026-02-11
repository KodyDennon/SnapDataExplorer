import { useUpdater } from "../hooks/useUpdater";
import { Card } from "./ui";
import { X, Info, Shield, Github, Sparkles, RefreshCw, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState } from "react";
import { cn } from "../lib/utils";

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AboutModal({ isOpen, onClose }: AboutModalProps) {
  const { checking, downloading, progress, update, checkForUpdates, installUpdate } = useUpdater();
  const [version, setVersion] = useState<string>("...");

  useEffect(() => {
    getVersion().then(setVersion);
  }, []);

  if (!isOpen) return null;

  return (
    <AnimatePresence mode="wait">
      <div className="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-lg bg-surface-50 dark:bg-surface-950 rounded-3xl shadow-2xl overflow-hidden border border-surface-200 dark:border-surface-800"
        >
          {/* Header */}
          <div className="p-6 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between bg-white dark:bg-surface-900">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-brand-500 to-accent-purple flex items-center justify-center shadow-lg">
                <Info className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-black text-surface-900 dark:text-white leading-tight">About</h2>
                <p className="text-xs text-surface-400 font-bold uppercase tracking-wider">Snap Data Explorer</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={downloading}
              className="p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-400 transition-colors disabled:opacity-20"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
            {/* App Info */}
            <div className="text-center space-y-3 py-4">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-linear-to-br from-brand-500 to-accent-purple p-0.5 shadow-2xl">
                <div className="w-full h-full rounded-[22px] bg-white dark:bg-surface-900 flex items-center justify-center overflow-hidden">
                   <img src="/logo.png" alt="Logo" className="w-12 h-12 object-contain" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">Snap Data Explorer</h3>
                <p className="text-sm font-bold text-brand-500">Version {version}</p>
              </div>
              <p className="text-sm text-surface-500 dark:text-surface-400 max-w-sm mx-auto leading-relaxed">
                A privacy-first desktop application for forensic data archaeology and visual exploration of Snapchat archives.
              </p>
            </div>

            {/* Features/Badges */}
            <div className="grid grid-cols-2 gap-3">
              <InfoBadge icon={<Shield className="w-4 h-4" />} label="100% Local" />
              <InfoBadge icon={<Sparkles className="w-4 h-4" />} label="AI Developed" />
            </div>

            {/* Update Section */}
            <Card variant="surface" padding="lg" className="border-brand-500/20 bg-brand-500/5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <RefreshCw className={cn("w-4 h-4 text-brand-500", (checking || downloading) && "animate-spin")} />
                  <span className="text-sm font-bold text-surface-900 dark:text-white uppercase tracking-wider">
                    {downloading ? "Installing Update" : "Updates"}
                  </span>
                </div>
                {update && !downloading && (
                  <span className="px-2 py-0.5 rounded-full bg-green-500 text-[10px] font-black text-white uppercase animate-pulse">
                    v{update.version} available
                  </span>
                )}
              </div>

              {downloading ? (
                <div className="space-y-3">
                  <div className="w-full bg-surface-200 dark:bg-surface-800 h-2 rounded-full overflow-hidden">
                    <motion.div 
                      className="bg-brand-500 h-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress?.percent || 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-surface-500 uppercase">
                    <span>Downloading...</span>
                    <span>{Math.round(progress?.percent || 0)}%</span>
                  </div>
                </div>
              ) : update ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800">
                    <p className="text-xs font-black text-surface-400 mb-2 uppercase tracking-widest text-center border-b border-surface-100 dark:border-surface-800 pb-2">What's New in v{update.version}</p>
                    <div className="text-sm text-surface-600 dark:text-surface-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto custom-scrollbar pr-2">
                      {update.body || "Performance improvements and bug fixes."}
                    </div>
                  </div>
                  <button
                    onClick={installUpdate}
                    className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-brand-600/20 transition-all flex items-center justify-center gap-2"
                  >
                    Update Now
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => checkForUpdates()}
                  disabled={checking}
                  className="w-full py-3 bg-surface-200 dark:bg-surface-800 hover:bg-surface-300 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-200 rounded-2xl text-sm font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {checking ? "Checking..." : "Check for Updates"}
                </button>
              )}
            </Card>

            {/* Links */}
            <div className="space-y-2">
              <FooterLink 
                icon={<Github className="w-4 h-4" />} 
                label="GitHub Repository" 
                href="https://github.com/KodyDennon/SnapDataExplorer" 
              />
            </div>
          </div>

          <div className="p-4 bg-surface-100 dark:bg-surface-900/50 text-center border-t border-surface-200 dark:border-surface-800">
            <p className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">
              Developed by Kody Dennon & AI Team
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function InfoBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-surface-100 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 transition-all hover:border-brand-500/30">
      <div className="text-brand-500">{icon}</div>
      <span className="text-xs font-black text-surface-700 dark:text-surface-200 uppercase tracking-tight">{label}</span>
    </div>
  );
}

function FooterLink({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between p-4 rounded-2xl hover:bg-surface-100 dark:hover:bg-surface-900 group transition-all"
    >
      <div className="flex items-center gap-3">
        <div className="text-surface-400 group-hover:text-brand-500 transition-colors">{icon}</div>
        <span className="text-sm font-bold text-surface-600 dark:text-surface-300">{label}</span>
      </div>
      <ChevronRight className="w-4 h-4 text-surface-300 group-hover:text-surface-500 transition-all group-hover:translate-x-1" />
    </a>
  );
}