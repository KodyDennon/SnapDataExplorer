import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { Event as Message, MessagePage, Conversation } from "../types";
import { convertFileSrc } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { Toast } from "../hooks/useToast";

function MediaFallback({ type }: { type: "image" | "video" | "snap" | "snap-video" }) {
  const icons: Record<string, string> = { image: "\u{1F5BC}\uFE0F", video: "\u{25B6}\uFE0F", snap: "\u{1F4F8}", "snap-video": "\u{25B6}\uFE0F" };
  const labels: Record<string, string> = { image: "Image failed to load", video: "Video failed to load", snap: "Snap image failed to load", "snap-video": "Snap video failed to load" };
  return (
    <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4 flex items-center gap-2 border border-slate-200 dark:border-slate-700">
      <span className="text-xl">{icons[type]}</span>
      <span className="text-xs text-slate-400">{labels[type]}</span>
    </div>
  );
}

interface ChatViewProps {
  conversationId: string;
  addToast: (type: Toast["type"], message: string) => void;
}

const PAGE_SIZE = 500;

export function ChatView({ conversationId, addToast }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [jumpDate, setJumpDate] = useState("");
  const [exporting, setExporting] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [failedMedia, setFailedMedia] = useState<Set<string>>(new Set());
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const offsetRef = useRef(0);

  const loadMessages = useCallback(async (append = false) => {
    if (!append) {
      setLoading(true);
      offsetRef.current = 0;
    } else {
      setLoadingMore(true);
    }
    try {
      const page = await invoke<MessagePage>("get_messages_page", {
        conversationId,
        offset: offsetRef.current,
        limit: PAGE_SIZE,
      });
      if (append) {
        setMessages(prev => [...prev, ...page.messages]);
      } else {
        setMessages(page.messages);
      }
      setTotalCount(page.total_count);
      offsetRef.current += page.messages.length;
    } catch (e) {
      console.error(e);
      if (!append) addToast("error", "Failed to load messages.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setInitialLoad(false);
    }
  }, [conversationId]);

  const loadMore = useCallback(() => {
    if (!loadingMore && offsetRef.current < totalCount) {
      loadMessages(true);
    }
  }, [loadingMore, totalCount, loadMessages]);

  // Load display name for this conversation
  useEffect(() => {
    setDisplayName(null);
    invoke<Conversation[]>("get_conversations").then((convos) => {
      const match = convos.find((c) => c.id === conversationId);
      if (match?.display_name) {
        setDisplayName(match.display_name);
      }
    }).catch(() => {});
  }, [conversationId]);

  useEffect(() => {
    setMessages([]);
    setInitialLoad(true);
    setFailedMedia(new Set());
    loadMessages();
  }, [conversationId, loadMessages]);

  useEffect(() => {
    if (!initialLoad && messages.length > 0 && virtuosoRef.current) {
      setTimeout(() => {
        virtuosoRef.current?.scrollToIndex({
          index: messages.length - 1,
          behavior: "auto",
        });
      }, 100);
    }
  }, [initialLoad, messages.length]);

  async function handleJumpToDate() {
    if (!jumpDate) return;
    try {
      const index = await invoke<number>("get_message_index_at_date", {
        conversationId,
        date: jumpDate,
      });
      virtuosoRef.current?.scrollToIndex({
        index: Math.min(index, messages.length - 1),
        behavior: "smooth",
        align: "start",
      });
      setShowDatePicker(false);
    } catch (e) {
      addToast("error", "Could not jump to that date.");
    }
  }

  async function handleExport(format: "text" | "json") {
    setExporting(true);
    try {
      const ext = format === "json" ? "json" : "txt";
      const fileName = displayName || conversationId;
      const filePath = await save({
        defaultPath: `${fileName}.${ext}`,
        filters: [{ name: format === "json" ? "JSON" : "Text", extensions: [ext] }],
      });
      if (filePath) {
        await invoke("export_conversation", {
          conversationId,
          format,
          outputPath: filePath,
        });
        addToast("success", `Conversation exported to ${filePath.split("/").pop() || filePath}`);
      }
    } catch (e) {
      addToast("error", `Export failed: ${e}`);
    } finally {
      setExporting(false);
    }
  }

  function markFailed(key: string) {
    setFailedMedia(prev => { const next = new Set(prev); next.add(key); return next; });
  }

  function getMediaSrc(path: string): string {
    try {
      return convertFileSrc(path);
    } catch {
      return path;
    }
  }

  function isImageFile(path: string): boolean {
    const ext = path.split(".").pop()?.toLowerCase() || "";
    return ["jpg", "jpeg", "png", "webp", "heif", "gif"].includes(ext);
  }

  const headerName = displayName || conversationId;

  function renderMessage(index: number) {
    const msg = messages[index];
    if (!msg) return null;
    const isSameSender = index > 0 && messages[index - 1].sender === msg.sender;

    const showDateSep = index === 0 || (
      new Date(messages[index - 1].timestamp).toDateString() !== new Date(msg.timestamp).toDateString()
    );

    return (
      <div className="px-8">
        {showDateSep && (
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              {new Date(msg.timestamp).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
          </div>
        )}

        <div className={isSameSender && !showDateSep ? "mt-1" : "mt-4"}>
          {(!isSameSender || showDateSep) && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                {msg.sender_name || msg.sender}
              </span>
              <span className="text-[9px] font-bold text-slate-300 dark:text-slate-500 uppercase">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          )}

          <div
            className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm max-w-2xl transition-all hover:shadow-md group/msg ${!isSameSender || showDateSep ? "rounded-tl-none" : ""}`}
          >
            {msg.event_type === "TEXT" && (
              <div className="relative">
                <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium pr-8">{msg.content}</p>
                {msg.content && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(msg.content || "");
                      addToast("info", "Copied to clipboard");
                    }}
                    className="absolute top-0 right-0 opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 rounded text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400"
                    aria-label="Copy message"
                    title="Copy"
                  >
                    {"\u{1F4CB}"}
                  </button>
                )}
              </div>
            )}

            {(msg.event_type === "MEDIA" || msg.event_type === "NOTE") && (
              <div className="space-y-3">
                {msg.media_references.length > 0 ? (
                  msg.media_references.map((ref_, i) => {
                    const mediaKey = `${msg.id}-${i}`;
                    if (failedMedia.has(mediaKey)) return <MediaFallback key={i} type={isImageFile(ref_) ? "image" : "video"} />;
                    return (
                      <div key={i} className="rounded-xl overflow-hidden">
                        {isImageFile(ref_) ? (
                          <img
                            src={getMediaSrc(ref_)}
                            alt="Media"
                            className="max-w-full max-h-80 rounded-xl object-contain bg-slate-100 dark:bg-slate-800"
                            loading="lazy"
                            onError={() => markFailed(mediaKey)}
                          />
                        ) : (
                          <video
                            src={getMediaSrc(ref_)}
                            controls
                            className="max-w-full max-h-80 rounded-xl bg-black"
                            preload="metadata"
                            onError={() => markFailed(mediaKey)}
                          />
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-6 flex flex-col items-center justify-center border border-slate-200 dark:border-slate-700">
                    <span className="text-3xl mb-1">{"\u{1F39E}\uFE0F"}</span>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">Media not linked</span>
                  </div>
                )}
                {msg.content && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 italic border-l-2 border-slate-200 dark:border-slate-700 pl-3">{msg.content}</p>
                )}
              </div>
            )}

            {(msg.event_type === "SNAP" || msg.event_type === "SNAP_VIDEO") && (
              msg.media_references.length > 0 ? (
                <div className="space-y-3">
                  {msg.media_references.map((ref_, i) => {
                    const mediaKey = `${msg.id}-snap-${i}`;
                    if (failedMedia.has(mediaKey)) return <MediaFallback key={i} type={isImageFile(ref_) ? "snap" : "snap-video"} />;
                    return (
                      <div key={i} className="rounded-xl overflow-hidden">
                        {isImageFile(ref_) ? (
                          <img
                            src={getMediaSrc(ref_)}
                            alt="Snap"
                            className="max-w-full max-h-80 rounded-xl object-contain bg-slate-100 dark:bg-slate-800"
                            loading="lazy"
                            onError={() => markFailed(mediaKey)}
                          />
                        ) : (
                          <video
                            src={getMediaSrc(ref_)}
                            controls
                            preload="metadata"
                            className="max-w-full max-h-80 rounded-xl bg-black"
                            onError={() => markFailed(mediaKey)}
                          />
                        )}
                      </div>
                    );
                  })}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-wider">{msg.event_type === "SNAP_VIDEO" ? "Snap Video" : "Snap"}</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 py-1">
                  <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center text-yellow-600 dark:text-yellow-300">{"\u{1F4F8}"}</div>
                  <div>
                    <p className="text-sm font-black text-slate-800 dark:text-slate-200 italic">{msg.content || "Snap"}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">Content expired in original app</p>
                  </div>
                </div>
              )
            )}

            {msg.event_type === "MISSED_VIDEO_CHAT" && (
              <div className="flex items-center gap-3 text-red-400 py-1">
                <span className="text-xl">{"\u{1F4F9}"}</span>
                <span className="text-xs font-bold uppercase tracking-tight">Missed Video Chat</span>
              </div>
            )}

            {msg.event_type === "MISSED_AUDIO_CHAT" && (
              <div className="flex items-center gap-3 text-red-400 py-1">
                <span className="text-xl">{"\u{1F4DE}"}</span>
                <span className="text-xs font-bold uppercase tracking-tight">Missed Audio Chat</span>
              </div>
            )}

            {msg.event_type === "STICKER" && (
              msg.media_references.length > 0 ? (
                <div className="space-y-2">
                  {msg.media_references.map((ref_, i) => {
                    const mediaKey = `${msg.id}-sticker-${i}`;
                    if (failedMedia.has(mediaKey)) return null;
                    return (
                      <img
                        key={i}
                        src={getMediaSrc(ref_)}
                        alt="Sticker"
                        className="max-w-[160px] max-h-[160px] object-contain"
                        loading="lazy"
                        onError={() => markFailed(mediaKey)}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-3 py-1">
                  <span className="text-2xl">{"\u{1F3AD}"}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Sticker</span>
                </div>
              )
            )}

            {msg.event_type === "SHARE" && (
              <div className="flex items-center gap-3 py-1">
                <span className="text-xl">{"\u{1F517}"}</span>
                <p className="text-sm text-slate-600 dark:text-slate-400">{msg.content || "Shared content"}</p>
              </div>
            )}

            {["STATUSPARTICIPANTREMOVED", "STATUSPARTICIPANTADDED", "STATUSCONVERSATIONNAMECHANGED"].includes(msg.event_type) && (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic text-center">{msg.content || msg.event_type}</p>
            )}

            {msg.event_type === "UNKNOWN" && msg.content && (
              <p className="text-slate-800 dark:text-slate-200 leading-relaxed">{msg.content}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#F7F8FA] dark:bg-slate-950 h-full relative">
      <header className="h-20 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-8 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-900 dark:bg-slate-700 rounded-full flex items-center justify-center text-white font-bold">
            {headerName.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <h2 className="font-black text-slate-900 dark:text-slate-100 leading-none">{headerName}</h2>
            {displayName && displayName !== conversationId && (
              <p className="text-[9px] text-slate-300 dark:text-slate-600 font-mono mt-0.5">{conversationId}</p>
            )}
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
              {totalCount.toLocaleString()} messages
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors text-sm font-bold"
              title="Jump to date"
              aria-label="Jump to date"
              aria-expanded={showDatePicker}
            >
              {"\u{1F4C5}"} Jump
            </button>
            {showDatePicker && (
              <div className="absolute right-0 top-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-4 z-20 w-64">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Jump to Date</p>
                <input
                  type="date"
                  value={jumpDate}
                  onChange={(e) => setJumpDate(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm mb-3 focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-500 outline-none dark:bg-slate-700 dark:text-slate-200"
                />
                <button
                  onClick={handleJumpToDate}
                  disabled={!jumpDate}
                  className="w-full bg-slate-900 dark:bg-slate-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-slate-800 dark:hover:bg-slate-500 disabled:opacity-40 transition-all"
                >
                  Go
                </button>
              </div>
            )}
          </div>
          <div className="relative group">
            <button
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors text-sm font-bold"
              title="Export conversation"
              aria-label="Export conversation"
              disabled={exporting}
            >
              {exporting ? "\u{23F3}" : "\u{1F4E4}"} Export
            </button>
            <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden z-20 hidden group-hover:block">
              <button onClick={() => handleExport("text")} className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 font-medium dark:text-slate-200">
                Plain Text (.txt)
              </button>
              <button onClick={() => handleExport("json")} className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 font-medium dark:text-slate-200">
                JSON (.json)
              </button>
            </div>
          </div>
        </div>
      </header>

      {loading && initialLoad ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-slate-200 dark:border-slate-700 border-t-slate-900 dark:border-t-slate-300 rounded-full animate-spin" />
        </div>
      ) : (
        <Virtuoso
          ref={virtuosoRef}
          style={{ height: "100%" }}
          totalCount={messages.length}
          itemContent={renderMessage}
          endReached={loadMore}
          followOutput="auto"
          overscan={200}
        />
      )}
    </div>
  );
}
