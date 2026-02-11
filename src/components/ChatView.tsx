import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { Event as Message, MessagePage, Conversation, MediaViewerItem } from "../types";
import { convertFileSrc } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { Toast } from "../hooks/useToast";
import { MediaViewer } from "./ui/MediaViewer";
import { 
  Image as ImageIcon, 
  Play, 
  FileText, 
  Smartphone, 
  PhoneMissed, 
  Hash, 
  RefreshCw,
  ChevronDown,
  Info
} from "lucide-react";
import { cn } from "../lib/utils";
import { AnimatePresence, motion } from "framer-motion";

function MediaFallback({ type }: { type: "image" | "video" | "snap" | "snap-video" }) {
  return (
    <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center border border-dashed border-slate-300 dark:border-slate-700">
      <ImageIcon className="w-8 h-8 text-slate-300 mb-2" />
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{type} failed to load</span>
    </div>
  );
}

interface ChatViewProps {
  conversationId: string;
  addToast: (type: Toast["type"], message: string) => void;
}

const PAGE_SIZE = 500;

// Optimized Memoized Message Component
const MessageItem = React.memo(({
  msg,
  isSameSender,
  showDateSep,
  onOpenMedia,
  markFailed,
  failedMedia,
  addToast
}: {
  msg: Message,
  isSameSender: boolean,
  showDateSep: boolean,
  onOpenMedia: (ref: string) => void,
  markFailed: (key: string) => void,
  failedMedia: Set<string>,
  addToast: (type: Toast["type"], message: string) => void
}) => {
  // Pre-compute media sources to avoid logic in render
  const mediaSources = useMemo(() => {
    return msg.media_references.map(ref => {
      try {
        return convertFileSrc(ref);
      } catch {
        return ref;
      }
    });
  }, [msg.media_references]);

  function isImageFile(path: string): boolean {
    const ext = path.split(".").pop()?.toLowerCase() || "";
    return ["jpg", "jpeg", "png", "webp", "heif", "gif"].includes(ext);
  }

  return (
    <div className="px-8" style={{ contain: "content" }}>
      {showDateSep && (
        <div className="flex items-center gap-4 my-8">
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
            {new Date(msg.timestamp).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </span>
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
        </div>
      )}

      <div className={cn("flex flex-col", isSameSender && !showDateSep ? "mt-1" : "mt-6")}>
        {(!isSameSender || showDateSep) && (
          <div className="flex items-center gap-3 mb-2 px-1">
            <span className="text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              {msg.sender_name || msg.sender}
            </span>
            <span className="text-[9px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-widest">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        )}

        <div
          className={cn(
            "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-sm max-w-2xl transition-all hover:shadow-md group/msg relative",
            !isSameSender || showDateSep ? "rounded-2xl rounded-tl-none" : "rounded-2xl"
          )}
        >
          {msg.event_type === "TEXT" && (
            <div className="relative group">
              <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium pr-10 whitespace-pre-wrap break-words">{msg.content}</p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(msg.content || "");
                  addToast("info", "Copied to clipboard");
                }}
                className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <FileText className="w-4 h-4" />
              </button>
            </div>
          )}

          {(msg.event_type === "MEDIA" || msg.event_type === "NOTE") && (
            <div className="space-y-3">
              {msg.media_references.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {msg.media_references.map((ref_, i) => {
                    const mediaKey = `${msg.id}-${i}`;
                    const src = mediaSources[i];
                    if (failedMedia.has(mediaKey)) return <MediaFallback key={i} type={isImageFile(ref_) ? "image" : "video"} />;
                    return (
                      <div
                        key={i}
                        onClick={() => onOpenMedia(ref_)}
                        className="relative rounded-2xl overflow-hidden cursor-pointer group/media bg-slate-100 dark:bg-slate-800 aspect-square sm:aspect-auto"
                      >
                        {isImageFile(ref_) ? (
                          <img
                            src={src}
                            alt="Media"
                            className="max-w-full max-h-80 rounded-xl object-contain group-hover/media:scale-105 transition-transform duration-500"
                            loading="lazy"
                            onError={() => markFailed(mediaKey)}
                          />
                        ) : (
                          <div className="relative">
                            <video
                              src={src}
                              className="max-w-full max-h-80 rounded-xl bg-black"
                              preload="none"
                              onError={() => markFailed(mediaKey)}
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/media:bg-black/40 transition-colors">
                              <Play className="w-10 h-10 text-white fill-current" />
                            </div>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover/media:opacity-100 transition-opacity" />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center border border-slate-200 dark:border-slate-800">
                  <ImageIcon className="w-8 h-8 text-slate-300 mb-2" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Media not linked</span>
                </div>
              )}
              {msg.content && (
                <p className="text-sm text-slate-600 dark:text-slate-400 font-medium border-l-2 border-purple-500 pl-3 py-1">{msg.content}</p>
              )}
            </div>
          )}

          {(msg.event_type === "SNAP" || msg.event_type === "SNAP_VIDEO") && (
            msg.media_references.length > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-2">
                  {msg.media_references.map((ref_, i) => {
                    const mediaKey = `${msg.id}-snap-${i}`;
                    const src = mediaSources[i];
                    if (failedMedia.has(mediaKey)) return <MediaFallback key={i} type={isImageFile(ref_) ? "snap" : "snap-video"} />;
                    return (
                      <div
                        key={i}
                        onClick={() => onOpenMedia(ref_)}
                        className="relative rounded-2xl overflow-hidden cursor-pointer group/snap bg-slate-100 dark:bg-slate-800"
                      >
                        {isImageFile(ref_) ? (
                          <img
                            src={src}
                            alt="Snap"
                            className="max-w-full max-h-96 rounded-2xl object-contain group-hover/snap:scale-105 transition-transform duration-500"
                            loading="lazy"
                            onError={() => markFailed(mediaKey)}
                          />
                        ) : (
                          <div className="relative">
                            <video
                              src={src}
                              preload="none"
                              className="max-w-full max-h-96 rounded-2xl bg-black"
                              onError={() => markFailed(mediaKey)}
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/snap:bg-black/40 transition-colors">
                              <Smartphone className="w-10 h-10 text-white" />
                            </div>
                          </div>
                        )}
                        <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-yellow-400 text-black text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-xl">
                          <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                          {msg.event_type === "SNAP_VIDEO" ? "Video Snap" : "Snap"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 py-2">
                <div className="w-12 h-12 bg-yellow-400/10 rounded-2xl flex items-center justify-center text-yellow-500 border border-yellow-400/20">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{msg.content || "Snap"}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Content expired</p>
                </div>
              </div>
            )
          )}

          {msg.event_type === "MISSED_VIDEO_CHAT" && (
            <div className="flex items-center gap-3 text-red-500 py-1 px-1">
              <PhoneMissed className="w-5 h-5" />
              <span className="text-[10px] font-black uppercase tracking-widest">Missed Video Chat</span>
            </div>
          )}

          {msg.event_type === "MISSED_AUDIO_CHAT" && (
            <div className="flex items-center gap-3 text-red-500 py-1 px-1">
              <PhoneMissed className="w-5 h-5" />
              <span className="text-[10px] font-black uppercase tracking-widest">Missed Audio Chat</span>
            </div>
          )}

          {msg.event_type === "STICKER" && (
            msg.media_references.length > 0 ? (
              <div className="p-2">
                {msg.media_references.map((_, i) => {
                  const mediaKey = `${msg.id}-sticker-${i}`;
                  const src = mediaSources[i];
                  if (failedMedia.has(mediaKey)) return null;
                  return (
                    <img
                      key={i}
                      src={src}
                      alt="Sticker"
                      className="max-w-[140px] max-h-[140px] drop-shadow-xl hover:scale-110 transition-transform duration-300"
                      loading="lazy"
                      onError={() => markFailed(mediaKey)}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-3 py-1 text-slate-400 font-bold">
                <ImageIcon className="w-5 h-5 opacity-50" />
                <span className="text-xs uppercase tracking-widest">Sticker</span>
              </div>
            )
          )}

          {msg.event_type === "SHARE" && (
            <div className="flex items-center gap-4 py-1">
              <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400">
                <Play className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{msg.content || "Shared content"}</p>
            </div>
          )}

          {["STATUSPARTICIPANTREMOVED", "STATUSPARTICIPANTADDED", "STATUSCONVERSATIONNAMECHANGED"].includes(msg.event_type) && (
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center py-2">{msg.content || msg.event_type}</p>
          )}
        </div>
      </div>
    </div>
  );
});

MessageItem.displayName = "MessageItem";

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
  const [viewerIndex, setViewerIndex] = useState(-1);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const offsetRef = useRef(0);

  // Derive all media items for the viewer - memoized and optimized
  const chatMediaItems = useMemo(() => {
    const items: MediaViewerItem[] = [];
    for (const msg of messages) {
      if (["MEDIA", "NOTE", "SNAP", "SNAP_VIDEO"].includes(msg.event_type)) {
        for (const ref of msg.media_references) {
          items.push({
            ...msg,
            path: ref,
            media_type: msg.event_type.includes("VIDEO") ? "Video" : "Image"
          });
        }
      }
    }
    return items;
  }, [messages]);

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
  }, [conversationId, addToast]);

  const loadMore = useCallback(() => {
    if (!loadingMore && offsetRef.current < totalCount) {
      loadMessages(true);
    }
  }, [loadingMore, totalCount, loadMessages]);

  useEffect(() => {
    setDisplayName(null);
    invoke<Conversation[]>("get_conversations").then((convos) => {
      const match = convos.find((c) => c.id === conversationId);
      if (match?.display_name) {
        setDisplayName(match.display_name);
      }
    }).catch(() => { });
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

  const markFailed = useCallback((key: string) => {
    setFailedMedia(prev => { const next = new Set(prev); next.add(key); return next; });
  }, []);

  const openAtRef = useCallback((ref: string, msgId: string) => {
    const itemIdx = chatMediaItems.findIndex(item => item.path === ref && item.id === msgId);
    if (itemIdx >= 0) setViewerIndex(itemIdx);
  }, [chatMediaItems]);

  const scrollToBottom = () => {
    virtuosoRef.current?.scrollToIndex({
      index: messages.length - 1,
      behavior: "smooth"
    });
  };

  const headerName = displayName || conversationId;

  return (
    <div className="flex-1 flex flex-col bg-[#F7F8FA] dark:bg-slate-950 h-full relative overflow-hidden">
      <header className="h-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-10 shadow-sm z-10 sticky top-0">
        <div className="flex items-center gap-5">
          <div className="w-11 h-11 bg-gradient-to-br from-brand-500 to-accent-purple rounded-2xl flex items-center justify-center text-white font-black shadow-lg shadow-brand-500/20">
            {headerName.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <h2 className="font-black text-lg text-slate-900 dark:text-slate-100 leading-none tracking-tight flex items-center gap-2">
              {headerName}
              <Info className="w-3.5 h-3.5 text-slate-300 hover:text-brand-500 cursor-help transition-colors" />
            </h2>
            <div className="flex items-center gap-3 mt-1.5">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.1em]">
                {totalCount.toLocaleString()} messages
              </p>
              {displayName && displayName !== conversationId && (
                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[8px] font-black text-slate-400 uppercase">
                  {conversationId}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
                showDatePicker ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
            >
              <Hash className="w-4 h-4" /> Jump
            </button>
            <AnimatePresence>
              {showDatePicker && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 top-full mt-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-2xl p-5 z-20 w-72"
                >
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 mb-3 uppercase tracking-widest">Jump to History</p>
                  <input
                    type="date"
                    value={jumpDate}
                    onChange={(e) => setJumpDate(e.target.value)}
                    className="w-full border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 text-sm mb-4 focus:ring-2 focus:ring-purple-500/50 outline-none dark:bg-slate-900 dark:text-slate-200 transition-all"
                  />
                  <button
                    onClick={handleJumpToDate}
                    disabled={!jumpDate}
                    className="w-full bg-purple-600 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-purple-500 disabled:opacity-40 transition-all shadow-lg shadow-purple-500/20"
                  >
                    Execute Jump
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="relative group">
            <button
              className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-all flex items-center gap-2"
              disabled={exporting}
            >
              {exporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Export
            </button>
            <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-20 hidden group-hover:block w-48 animate-in fade-in slide-in-from-top-2">
              <button onClick={() => handleExport("text")} className="block w-full text-left px-5 py-3 text-xs font-bold uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-slate-200 transition-colors">
                Archive (.txt)
              </button>
              <button onClick={() => handleExport("json")} className="block w-full text-left px-5 py-3 text-xs font-bold uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-slate-200 transition-colors">
                Database (.json)
              </button>
            </div>
          </div>
        </div>
      </header>

      {loading && initialLoad ? (
        <div className="flex-1 flex items-center justify-center">
          <RefreshCw className="w-10 h-10 text-brand-500 animate-spin" />
        </div>
      ) : (
        <div className="flex-1 relative overflow-hidden">
          <Virtuoso
            ref={virtuosoRef}
            style={{ height: "100%", width: "100%" }}
            totalCount={messages.length}
            itemContent={(index) => {
              const msg = messages[index];
              if (!msg) return null;
              const isSameSender = index > 0 && messages[index - 1].sender === msg.sender;
              const showDateSep = index === 0 || (
                new Date(messages[index - 1].timestamp).toDateString() !== new Date(msg.timestamp).toDateString()
              );
              return (
                <MessageItem
                  msg={msg}
                  isSameSender={isSameSender}
                  showDateSep={showDateSep}
                  onOpenMedia={(ref) => openAtRef(ref, msg.id)}
                  markFailed={markFailed}
                  failedMedia={failedMedia}
                  addToast={addToast}
                />
              );
            }}
            endReached={loadMore}
            followOutput="auto"
            overscan={300}
            atBottomStateChange={(atBottom) => setShowScrollToBottom(!atBottom)}
          />

          <AnimatePresence>
            {showScrollToBottom && (
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                onClick={scrollToBottom}
                className="absolute bottom-6 right-6 p-3 rounded-full bg-brand-600 text-white shadow-xl hover:bg-brand-500 transition-colors z-20 group"
              >
                <ChevronDown className="w-6 h-6 group-hover:translate-y-0.5 transition-transform" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      )}

      <MediaViewer
        isOpen={viewerIndex >= 0}
        onClose={() => setViewerIndex(-1)}
        items={chatMediaItems}
        currentIndex={viewerIndex}
        onIndexChange={setViewerIndex}
      />
    </div>
  );
}

