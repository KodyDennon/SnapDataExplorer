import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Virtuoso } from "react-virtuoso";
import { Conversation } from "../types";
import { cn } from "../lib/utils";

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
    most_messages: "Most",
    least_messages: "Least",
    name_az: "A→Z",
    name_za: "Z→A",
  };

  const filterLabel: Record<FilterOption, string> = {
    all: "All",
    has_media: "Media",
    "10plus": "10+",
    "100plus": "100+",
  };

  return (
    <div className="w-80 border-r border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 flex flex-col h-full">
      {/* Header */}
      <div className="p-5 border-b border-surface-100 dark:border-surface-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-surface-900 dark:text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Conversations
          </h2>
          <button
            onClick={() => setShowControls(!showControls)}
            className={cn(
              "p-2 rounded-lg transition-all",
              showControls || sortBy !== "recent" || filterBy !== "all"
                ? "bg-brand-500 text-white"
                : "bg-surface-100 dark:bg-surface-800 text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700"
            )}
            title="Sort & Filter"
            aria-label="Sort and filter conversations"
            aria-expanded={showControls}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search..."
            aria-label="Search conversations"
            className="w-full bg-surface-100 dark:bg-surface-800 border-none rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all text-surface-800 dark:text-surface-200 placeholder-surface-400"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Controls Panel */}
        {showControls && (
          <div className="mt-4 space-y-3 animate-fade-in">
            <div>
              <p className="text-[10px] font-bold text-surface-400 uppercase tracking-wider mb-2">Sort by</p>
              <div className="flex flex-wrap gap-1">
                {(Object.keys(sortLabel) as SortOption[]).map(opt => (
                  <button
                    key={opt}
                    onClick={() => setSortBy(opt)}
                    className={cn(
                      "px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
                      sortBy === opt
                        ? "bg-brand-500 text-white"
                        : "bg-surface-100 dark:bg-surface-800 text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-700"
                    )}
                  >
                    {sortLabel[opt]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-surface-400 uppercase tracking-wider mb-2">Filter</p>
              <div className="flex flex-wrap gap-1">
                {(Object.keys(filterLabel) as FilterOption[]).map(opt => (
                  <button
                    key={opt}
                    onClick={() => setFilterBy(opt)}
                    className={cn(
                      "px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
                      filterBy === opt
                        ? "bg-brand-500 text-white"
                        : "bg-surface-100 dark:bg-surface-800 text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-700"
                    )}
                  >
                    {filterLabel[opt]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Stats bar */}
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-surface-400 font-medium">
            {processed.length} of {conversations.length}
          </p>
          {(sortBy !== "recent" || filterBy !== "all") && (
            <button
              onClick={() => { setSortBy("recent"); setFilterBy("all"); }}
              className="text-xs text-brand-500 hover:text-brand-600 font-semibold"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-hidden">
        {loading && conversations.length === 0 && (
          <div className="p-10 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-surface-200 dark:border-surface-700 border-t-brand-500 rounded-full animate-spin" />
            <p className="text-xs text-surface-400">Loading conversations...</p>
          </div>
        )}

        {!loading && processed.length === 0 && conversations.length === 0 && (
          <div className="p-10 text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-surface-500 font-semibold text-sm">No conversations yet</p>
            <p className="text-surface-400 text-xs">Import a Snapchat export to see your chats.</p>
          </div>
        )}

        {!loading && processed.length === 0 && conversations.length > 0 && (
          <div className="p-10 text-center space-y-3">
            <p className="text-surface-500 font-semibold text-sm">
              {search ? `No matches for "${search}"` : "No conversations match filters"}
            </p>
            {(filterBy !== "all" || search) && (
              <button
                onClick={() => { setSearch(""); setFilterBy("all"); }}
                className="text-xs text-brand-500 hover:text-brand-600 font-semibold"
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
              const isSelected = selectedId === c.id;
              return (
                <button
                  onClick={() => onSelect(c.id)}
                  className={cn(
                    "w-full text-left px-5 py-4 hover:bg-surface-50 dark:hover:bg-surface-800 transition-all flex flex-col gap-1.5 border-b border-surface-100 dark:border-surface-800 relative group",
                    isSelected && "bg-brand-50 dark:bg-brand-900/20"
                  )}
                >
                  {/* Selection indicator */}
                  {isSelected && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-500" />
                  )}

                  <div className="flex justify-between items-start gap-2">
                    <span className={cn(
                      "font-semibold truncate flex-1 leading-tight transition-colors",
                      isSelected
                        ? "text-brand-600 dark:text-brand-400"
                        : "text-surface-800 dark:text-surface-200 group-hover:text-brand-600 dark:group-hover:text-brand-400"
                    )}>
                      {c.display_name || c.id}
                    </span>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[24px] text-center",
                      isSelected
                        ? "bg-brand-500 text-white"
                        : "bg-surface-200 dark:bg-surface-700 text-surface-500 dark:text-surface-400"
                    )}>
                      {c.message_count}
                    </span>
                  </div>

                  <div className="flex justify-between items-center w-full">
                    <p className="text-xs text-surface-400 truncate max-w-[180px]">
                      {c.participants.join(", ")}
                    </p>
                    {c.last_event_at && (
                      <span className="text-[10px] font-medium text-surface-400">
                        {new Date(c.last_event_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </button>
              );
            }}
          />
        )}
      </div>
    </div>
  );
}
