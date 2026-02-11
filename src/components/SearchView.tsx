import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SearchResult } from "../types";
import { Toast } from "../hooks/useToast";
import { Search, Loader2, MessageSquare, Calendar, User, ArrowRight, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SearchViewProps {
  onNavigateToChat: (conversationId: string) => void;
  addToast: (type: Toast["type"], message: string) => void;
}

export function SearchView({ onNavigateToChat, addToast }: SearchViewProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setHasSearched(true);
    setSearchError(null);
    try {
      const data = await invoke<SearchResult[]>("search_messages", {
        query: query.trim(),
        limit: 100,
      });
      setResults(data);
    } catch (e) {
      const msg = String(e);
      setSearchError(msg.includes("fts5") ? "Search query contains special characters. Try simpler keywords." : `Search failed: ${msg}`);
      setResults([]);
      addToast("error", "Search failed. Try different keywords.");
    } finally {
      setLoading(false);
    }
  }, [query, addToast]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      handleSearch();
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-surface-50 dark:bg-surface-950 h-full overflow-hidden">
      <header className="bg-white/80 dark:bg-surface-900/80 backdrop-blur-md border-b border-surface-100 dark:border-surface-800 px-10 py-8 shadow-sm">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-black text-surface-900 dark:text-white mb-6 tracking-tight flex items-center gap-3">
            <Search className="w-8 h-8 text-brand-500" />
            Archive Search
          </h1>
          <div className="flex gap-3 bg-surface-100 dark:bg-surface-800 p-1.5 rounded-2xl border border-surface-200 dark:border-surface-700 shadow-inner group focus-within:ring-2 focus-within:ring-brand-500/50 transition-all">
            <input
              type="text"
              placeholder="Search across all conversations..."
              aria-label="Search all messages"
              className="flex-1 bg-transparent border-none px-4 py-3 text-base focus:ring-0 outline-none dark:text-surface-100 dark:placeholder-surface-500 font-medium"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            <button
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              className="bg-brand-600 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-brand-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-brand-500/20 flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {loading ? "Searching" : "Search"}
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-10 custom-scrollbar">
        <div className="max-w-4xl mx-auto">
          {searchError && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400 p-5 rounded-2xl mb-8 flex items-start gap-4 shadow-sm"
            >
              <AlertCircle className="w-6 h-6 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Search Exception</p>
                <p className="text-sm opacity-90">{searchError}</p>
              </div>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-24 gap-4"
              >
                <Loader2 className="w-12 h-12 text-brand-500 animate-spin" />
                <p className="text-surface-400 font-bold animate-pulse">Scanning Archive Database...</p>
              </motion.div>
            ) : hasSearched && results.length === 0 && !searchError ? (
              <motion.div 
                key="no-results"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-24"
              >
                <div className="w-20 h-20 bg-surface-100 dark:bg-surface-800 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <Search className="w-10 h-10 text-surface-300" />
                </div>
                <h3 className="text-surface-800 dark:text-white font-black text-2xl tracking-tight">No results found</h3>
                <p className="text-surface-400 mt-2 font-medium">Try broadening your search terms or using simpler keywords.</p>
              </motion.div>
            ) : !hasSearched ? (
              <motion.div 
                key="initial"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-24"
              >
                <div className="w-24 h-24 bg-brand-500/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-brand-500/10 border border-brand-500/10">
                  <Search className="w-12 h-12 text-brand-600" />
                </div>
                <h2 className="text-surface-900 dark:text-white font-black text-3xl tracking-tight mb-3">Forensic Search</h2>
                <p className="text-surface-500 dark:text-surface-400 text-lg max-w-md mx-auto leading-relaxed">
                  Search across your entire Snapchat history instantly using full-text indexing.
                </p>
                <div className="mt-10 flex flex-wrap justify-center gap-4 text-xs font-bold uppercase tracking-widest text-surface-400">
                  <span className="px-4 py-2 bg-surface-100 dark:bg-surface-800 rounded-full">Chat Content</span>
                  <span className="px-4 py-2 bg-surface-100 dark:bg-surface-800 rounded-full">Media Names</span>
                  <span className="px-4 py-2 bg-surface-100 dark:bg-surface-800 rounded-full">Event Types</span>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4 pb-20"
              >
                <div className="flex justify-between items-center mb-6 px-1">
                  <p className="text-xs font-black text-surface-400 uppercase tracking-widest">
                    Found {results.length.toLocaleString()} matching events
                  </p>
                </div>
                {results.map((result, i) => (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    key={result.event_id}
                    onClick={() => {
                      if (result.conversation_id) {
                        onNavigateToChat(result.conversation_id);
                      }
                    }}
                    className="w-full text-left bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl p-6 hover:border-brand-500/50 hover:shadow-xl hover:shadow-brand-500/5 transition-all group relative overflow-hidden"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 dark:text-brand-400">
                          <MessageSquare className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-surface-900 dark:text-white group-hover:text-brand-600 transition-colors">
                            {result.conversation_name || "Private Conversation"}
                          </h4>
                          <p className="text-[10px] font-black text-surface-400 uppercase tracking-tighter flex items-center gap-1">
                            <User className="w-2.5 h-2.5" /> {result.sender_name || result.sender}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] text-surface-400 font-bold flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" />
                          {new Date(result.timestamp).toLocaleDateString()}
                        </span>
                        <span className="text-[8px] px-2 py-0.5 bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400 rounded-full font-black uppercase tracking-tighter">
                          {result.event_type}
                        </span>
                      </div>
                    </div>
                    
                    <div className="relative">
                      <p className="text-surface-600 dark:text-surface-300 leading-relaxed font-medium line-clamp-3 pl-1 bg-surface-50/50 dark:bg-surface-800/30 p-3 rounded-xl border-l-4 border-brand-500">
                        {result.content}
                      </p>
                    </div>

                    <div className="absolute right-6 bottom-6 opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0 transition-transform">
                      <ArrowRight className="w-5 h-5 text-brand-500" />
                    </div>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
