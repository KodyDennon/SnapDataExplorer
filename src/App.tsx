import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "./components/Sidebar";
import { ConversationList } from "./components/ConversationList";
import { ChatView } from "./components/ChatView";
import { Dashboard } from "./components/Dashboard";
import { SetupFlow } from "./components/SetupFlow";
import { SearchView } from "./components/SearchView";
import { GalleryView } from "./components/GalleryView";
import { MemoriesView } from "./components/MemoriesView";
import { ChillGallery } from "./components/ChillGallery";
import { ToastContainer } from "./components/Toast";
import { ExportSet, IngestionProgress, IngestionResult } from "./types";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useTheme } from "./hooks/useTheme";
import { useToast } from "./hooks/useToast";
import { ViewMode } from "./components/ui/ModeToggle";
import { cn } from "./lib/utils";

function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [selectedConvo, setSelectedConvo] = useState<string | null>(null);
  const [currentExport, setCurrentExport] = useState<ExportSet | null>(null);
  const [progress, setProgress] = useState<IngestionProgress | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [hasData, setHasData] = useState<boolean | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("pro");
  const { theme, setTheme } = useTheme();
  const { toasts, addToast, removeToast } = useToast();

  const checkData = useCallback(async () => {
    try {
      const exports = await invoke<ExportSet[]>("get_exports");
      setHasData(exports.length > 0);
      if (exports.length > 0) {
        setCurrentExport(exports[0]);
      }
    } catch (e) {
      console.error("Failed to check data:", e);
      setHasData(false);
    }
  }, []);

  useEffect(() => {
    const unlistenProgress = listen<IngestionProgress>("ingestion-progress", (event) => {
      setProgress(event.payload);
      if (event.payload.current_step === "Complete") {
        setRefreshTrigger((n) => n + 1);
        checkData().then(() => {
          setTimeout(() => setProgress(null), 3000);
        });
      }
    });

    const unlistenResult = listen<IngestionResult>("ingestion-result", (event) => {
      const r = event.payload;
      if (r.errors.length > 0) {
        addToast("error", `Import had ${r.errors.length} error(s): ${r.errors[0]}`);
      } else if (r.warnings.length > 0) {
        addToast("warning", `Imported with ${r.warnings.length} warning(s). ${r.conversations_parsed} conversations, ${r.events_parsed} messages.`);
      } else {
        addToast("success", `Imported ${r.conversations_parsed} conversations, ${r.events_parsed} messages, ${r.memories_parsed} memories.`);
      }
    });

    checkData();

    return () => {
      unlistenProgress.then((f) => f());
      unlistenResult.then((f) => f());
    };
  }, [checkData, addToast]);

  function handleSelectExport(exp: ExportSet) {
    setCurrentExport(exp);
    setActivePage("dashboard");
  }

  function handleNavigateToChat(conversationId: string) {
    setSelectedConvo(conversationId);
    setActivePage("chats");
  }

  async function handleResetData() {
    try {
      await invoke("reset_data");
      setHasData(false);
      setCurrentExport(null);
      setSelectedConvo(null);
      setActivePage("dashboard");
      setRefreshTrigger((n) => n + 1);
      addToast("info", "All data cleared. You can import a new export.");
    } catch (e) {
      addToast("error", `Failed to reset data: ${e}`);
    }
  }

  async function handleReimport() {
    try {
      addToast("info", "Reimporting data...");
      setActivePage("dashboard");
      setSelectedConvo(null);
      await invoke("reimport_data");
    } catch (e) {
      addToast("error", `Reimport failed: ${e}`);
    }
  }

  // Setup Flow (No data or explicit setup trigger)
  if (hasData === false || showSetup) {
    return (
      <>
        <SetupFlow
          progress={progress}
          onComplete={() => {
            setShowSetup(false);
            checkData();
          }}
          addToast={addToast}
        />
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </>
    );
  }

  // Loading State
  if (hasData === null) {
    return (
      <div className="h-screen w-screen bg-surface-950 flex flex-col items-center justify-center gap-4">
        <div className="w-14 h-14 border-4 border-surface-700 border-t-brand-500 rounded-full animate-spin" />
        <p className="text-surface-400 font-semibold animate-pulse">Initializing Snap Explorer...</p>
      </div>
    );
  }

  // Main Application Layout
  return (
    <div className={cn(
      "flex h-screen w-screen overflow-hidden font-sans transition-colors duration-300",
      viewMode === "chill"
        ? "bg-gradient-to-br from-surface-900 via-surface-950 to-brand-950 text-white"
        : "bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-surface-100"
    )}>
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-50 md:hidden bg-surface-900 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg border border-surface-700"
        aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        {sidebarOpen ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Sidebar with responsive visibility */}
      <div className={cn(
        "transition-transform duration-300 ease-out fixed md:relative z-40 h-full",
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        viewMode === "chill" && "hidden md:hidden"
      )}>
        <Sidebar
          onSelectExport={handleSelectExport}
          onNavigate={(page) => { setActivePage(page); if (window.innerWidth < 768) setSidebarOpen(false); }}
          onOpenSetup={() => setShowSetup(true)}
          onResetData={handleResetData}
          onReimport={handleReimport}
          activePage={activePage}
          theme={theme}
          onThemeChange={setTheme}
          refreshTrigger={refreshTrigger}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      </div>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {viewMode === "chill" ? (
          <ChillGallery onExit={() => setViewMode("pro")} />
        ) : (
          <>
            {activePage === "dashboard" && (
              <Dashboard currentExport={currentExport} progress={progress} viewMode={viewMode} />
            )}

            {activePage === "chats" && (
              <>
                <ConversationList
                  onSelect={setSelectedConvo}
                  selectedId={selectedConvo}
                  refreshTrigger={refreshTrigger}
                />
                {selectedConvo ? (
                  <ChatView conversationId={selectedConvo} addToast={addToast} />
                ) : (
                  <div className="flex-1 flex items-center justify-center bg-surface-50 dark:bg-surface-900 flex-col gap-4">
                    <span className="text-6xl animate-bounce text-surface-200 dark:text-surface-700">💬</span>
                    <p className="font-bold text-xl text-surface-400">Select a conversation</p>
                  </div>
                )}
              </>
            )}

            {activePage === "search" && (
              <SearchView onNavigateToChat={handleNavigateToChat} addToast={addToast} />
            )}

            {activePage === "gallery" && <GalleryView />}

            {activePage === "memories" && <MemoriesView />}
          </>
        )}
      </main>

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

export default App;
