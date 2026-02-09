import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "./components/Sidebar";
import { ConversationList } from "./components/ConversationList";
import { ChatView } from "./components/ChatView";
import { Dashboard } from "./components/Dashboard";
import { SetupFlow } from "./components/SetupFlow";
import { SearchView } from "./components/SearchView";
import { GalleryView } from "./components/GalleryView";
import { ToastContainer } from "./components/Toast";
import { ExportSet, IngestionProgress, IngestionResult } from "./types";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useTheme } from "./hooks/useTheme";
import { useToast } from "./hooks/useToast";

function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [selectedConvo, setSelectedConvo] = useState<string | null>(null);
  const [currentExport, setCurrentExport] = useState<ExportSet | null>(null);
  const [progress, setProgress] = useState<IngestionProgress | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [hasData, setHasData] = useState<boolean | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
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

  if (hasData === null) {
    return (
      <div className="h-screen w-screen bg-slate-900 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-slate-700 border-t-yellow-400 rounded-full animate-spin" />
        <p className="text-slate-400 font-bold animate-pulse">Initializing Snap Explorer...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-50 md:hidden bg-slate-900 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
        aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        {sidebarOpen ? "\u{2715}" : "\u{2630}"}
      </button>

      {/* Sidebar with responsive visibility */}
      <div className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 transition-transform duration-200 fixed md:relative z-40 h-full`}>
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
        />
      </div>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="flex-1 flex overflow-hidden">
        {activePage === "dashboard" && (
          <Dashboard currentExport={currentExport} progress={progress} />
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
              <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-300 flex-col gap-4">
                <span className="text-6xl animate-bounce text-slate-200 dark:text-slate-600">{"\u{1F4AC}"}</span>
                <p className="font-bold text-xl text-slate-400">Select a thread to dive in</p>
              </div>
            )}
          </>
        )}

        {activePage === "search" && (
          <SearchView onNavigateToChat={handleNavigateToChat} addToast={addToast} />
        )}

        {activePage === "gallery" && <GalleryView />}
      </main>

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

export default App;
