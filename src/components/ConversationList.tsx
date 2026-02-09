import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Virtuoso } from "react-virtuoso";
import { Conversation } from "../types";

type SortOption = "recent" | "oldest" | "most_messages" | "least_messages" | "name_az" | "name_za";
type FilterOption = "all" | "has_media" | "10plus" | "100plus";

interface ConversationListProps {
  onSelect: (id: string) => void;
  selectedId: string | null;
  refreshTrigger?: number;
}

export function ConversationList({ onSelect, selectedId, refreshTrigger }: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");
  const [showControls, setShowControls] = useState(false);

  async function loadConversations() {
    setLoading(true);
    try {
      const data = await invoke<Conversation[]>("get_conversations");
      setConversations(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConversations();
  }, [refreshTrigger]);

  const processed = useMemo(() => {
    let result = conversations.filter(c =>
      (c.display_name || c.id).toLowerCase().includes(search.toLowerCase())
    );

    // Filter
    if (filterBy === "10plus") {
      result = result.filter(c => c.message_count >= 10);
    } else if (filterBy === "100plus") {
      result = result.filter(c => c.message_count >= 100);
    } else if (filterBy === "has_media") {
      result = result.filter(c => c.has_media);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "recent": {
          const aTime = a.last_event_at ? new Date(a.last_event_at).getTime() : 0;
          const bTime = b.last_event_at ? new Date(b.last_event_at).getTime() : 0;
          return bTime - aTime;
        }
        case "oldest": {
          const aTime = a.last_event_at ? new Date(a.last_event_at).getTime() : 0;
          const bTime = b.last_event_at ? new Date(b.last_event_at).getTime() : 0;
          return aTime - bTime;
        }
        case "most_messages":
          return b.message_count - a.message_count;
        case "least_messages":
          return a.message_count - b.message_count;
        case "name_az":
          return (a.display_name || a.id).localeCompare(b.display_name || b.id);
        case "name_za":
          return (b.display_name || b.id).localeCompare(a.display_name || a.id);
        default:
          return 0;
      }
    });

    return result;
  }, [conversations, search, sortBy, filterBy]);

  const sortLabel: Record<SortOption, string> = {
    recent: "Recent",
    oldest: "Oldest",
    most_messages: "Most msgs",
    least_messages: "Least msgs",
    name_az: "A \u2192 Z",
    name_za: "Z \u2192 A",
  };

  const filterLabel: Record<FilterOption, string> = {
    all: "All",
    has_media: "Has media",
    "10plus": "10+ msgs",
    "100plus": "100+ msgs",
  };

  return (
    <div className="w-80 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-col h-full shadow-sm">
      <div className="p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">Threads</h2>
          <button
            onClick={() => setShowControls(!showControls)}
            className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
              showControls || sortBy !== "recent" || filterBy !== "all"
                ? "bg-slate-900 dark:bg-yellow-400 text-white dark:text-slate-900"
                : "bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
            title="Sort & Filter"
            aria-label="Sort and filter conversations"
            aria-expanded={showControls}
          >
            {"\u{2195}\uFE0F"}
          </button>
        </div>

        <input
          type="text"
          placeholder="Search conversations..."
          aria-label="Search conversations"
          className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-500 outline-none transition-all dark:text-slate-200 dark:placeholder-slate-500"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {showControls && (
          <div className="mt-3 space-y-2">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Sort by</p>
              <div className="flex flex-wrap gap-1">
                {(Object.keys(sortLabel) as SortOption[]).map(opt => (
                  <button
                    key={opt}
                    onClick={() => setSortBy(opt)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                      sortBy === opt
                        ? "bg-slate-900 dark:bg-slate-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {sortLabel[opt]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Filter</p>
              <div className="flex flex-wrap gap-1">
                {(Object.keys(filterLabel) as FilterOption[]).map(opt => (
                  <button
                    key={opt}
                    onClick={() => setFilterBy(opt)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                      filterBy === opt
                        ? "bg-slate-900 dark:bg-slate-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {filterLabel[opt]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-2">
          <p className="text-[10px] text-slate-400 font-bold">
            {processed.length} of {conversations.length}
          </p>
          {(sortBy !== "recent" || filterBy !== "all") && (
            <button
              onClick={() => { setSortBy("recent"); setFilterBy("all"); }}
              className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold underline"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {loading && conversations.length === 0 && (
          <div className="p-10 flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-slate-200 dark:border-slate-700 border-t-slate-500 rounded-full animate-spin" />
            <p className="text-xs text-slate-400">Loading conversations...</p>
          </div>
        )}
        {!loading && processed.length === 0 && conversations.length === 0 && (
          <div className="p-10 text-center space-y-2">
            <p className="text-slate-400 font-bold text-sm">No conversations yet.</p>
            <p className="text-slate-300 dark:text-slate-600 text-xs">Import a Snapchat export to see your chats here.</p>
          </div>
        )}
        {!loading && processed.length === 0 && conversations.length > 0 && (
          <div className="p-10 text-center space-y-2">
            <p className="text-slate-400 font-bold italic text-sm">
              {search ? `No matches for "${search}"` : "No conversations match filters"}
            </p>
            {(filterBy !== "all" || search) && (
              <button
                onClick={() => { setSearch(""); setFilterBy("all"); }}
                className="text-xs text-indigo-500 hover:text-indigo-600 font-bold"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
        {processed.length > 0 && (
          <Virtuoso
            style={{ height: "100%" }}
            totalCount={processed.length}
            overscan={100}
            itemContent={(index) => {
              const c = processed[index];
              if (!c) return null;
              return (
                <button
                  onClick={() => onSelect(c.id)}
                  className={`w-full text-left p-5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex flex-col gap-1.5 border-b border-slate-50 dark:border-slate-800 relative group ${selectedId === c.id ? "bg-slate-100 dark:bg-slate-800 ring-inset ring-1 ring-slate-200 dark:ring-slate-700" : ""}`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-extrabold text-slate-900 dark:text-slate-100 truncate flex-1 leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {c.display_name || c.id}
                    </span>
                    <span className="text-[10px] font-black bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full min-w-5 text-center">
                      {c.message_count}
                    </span>
                  </div>

                  <div className="flex justify-between items-center w-full">
                    <p className="text-xs text-slate-400 truncate max-w-[180px]">
                      {c.participants.join(", ")}
                    </p>
                    {c.last_event_at && (
                      <span className="text-[9px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-tighter">
                        {new Date(c.last_event_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {selectedId === c.id && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-900 dark:bg-yellow-400"></div>
                  )}
                </button>
              );
            }}
          />
        )}
      </div>
    </div>
  );
}
