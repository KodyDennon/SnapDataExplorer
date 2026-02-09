import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SearchResult } from "../types";
import { Toast } from "../hooks/useToast";

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
  }, [query]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      handleSearch();
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 h-full">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-8 py-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">Search Messages</h1>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Search across all conversations..."
            aria-label="Search all messages"
            className="flex-1 bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-5 py-3 text-sm focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-500 outline-none transition-all dark:text-slate-200 dark:placeholder-slate-500"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="bg-slate-900 dark:bg-slate-700 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {searchError && (
          <div className="bg-red-50 dark:bg-red-950/50 border border-red-100 dark:border-red-900 text-red-600 dark:text-red-400 p-4 rounded-2xl mb-4 flex items-start gap-3">
            <span className="text-lg shrink-0">{"\u26A0\uFE0F"}</span>
            <p className="font-medium text-sm">{searchError}</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-slate-200 dark:border-slate-700 border-t-slate-900 dark:border-t-slate-300 rounded-full animate-spin" />
          </div>
        )}

        {!loading && hasSearched && results.length === 0 && !searchError && (
          <div className="text-center py-20">
            <p className="text-slate-400 font-bold text-lg">No results found</p>
            <p className="text-slate-300 dark:text-slate-600 mt-2">Try different keywords or check spelling</p>
          </div>
        )}

        {!loading && !hasSearched && (
          <div className="text-center py-20">
            <span className="text-6xl block mb-4">{"\u{1F50D}"}</span>
            <p className="text-slate-400 font-bold text-lg">Full-Text Search</p>
            <p className="text-slate-300 dark:text-slate-600 mt-2">Search across all your conversations instantly</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-bold text-slate-500 mb-4">
              {results.length} result{results.length !== 1 ? "s" : ""}
            </p>
            {results.map((result) => (
              <button
                key={result.event_id}
                onClick={() => {
                  if (result.conversation_id) {
                    onNavigateToChat(result.conversation_id);
                  }
                }}
                className="w-full text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md transition-all group"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {result.conversation_name || result.conversation_id || "Unknown"}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full font-bold uppercase">
                      {result.event_type}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-300 dark:text-slate-600 font-bold">
                    {new Date(result.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{result.content}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">
                  From: {result.sender_name || result.sender}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
