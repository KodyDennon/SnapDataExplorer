import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { VirtuosoGrid } from "react-virtuoso";
import { MediaStreamEntry, MediaViewerItem, PaginatedMedia } from "../types";
import { cn } from "../lib/utils";
import { MediaThumbnail } from "./ui/MediaThumbnail";
import { MediaViewer } from "./ui/MediaViewer";
import { Image as ImageIcon } from "lucide-react";

export function GalleryView() {
  const [media, setMedia] = useState<MediaStreamEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [viewerIndex, setViewerIndex] = useState(-1);
  const [filter, setFilter] = useState<"all" | "Image" | "Video">("all");
  const offsetRef = useRef(0);

  const loadMedia = useCallback(async (append = false) => {
    if (!append) {
      setLoading(true);
      offsetRef.current = 0;
    } else {
      setLoadingMore(true);
    }
    try {
      const data = await invoke<PaginatedMedia>("get_unified_media_stream", {
        limit: 100,
        offset: offsetRef.current,
      });
      if (append) {
        setMedia(prev => [...prev, ...data.items]);
      } else {
        setMedia(data.items);
      }
      setTotalCount(data.total_count);
      setHasMore(data.has_more);
      offsetRef.current += data.items.length;
    } catch (e) {
      console.error("Failed to load media:", e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      loadMedia(true);
    }
  }, [loadingMore, hasMore, loadMedia]);

  const filtered = useMemo(() =>
    filter === "all" ? media : media.filter(m => m.media_type === filter)
    , [media, filter]);

  return (
    <div className="flex-1 flex flex-col bg-zinc-950/20 backdrop-blur-sm h-full overflow-hidden">
      {/* Header */}
      <header className="px-8 py-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <ImageIcon className="w-8 h-8 text-purple-500" />
            Gallery
          </h1>
          <p className="text-sm text-white/40 font-medium mt-1">
            {totalCount.toLocaleString()} items total • {filtered.length.toLocaleString()} visible
          </p>
        </div>
        <div className="flex gap-1.5 bg-white/5 border border-white/10 p-1 rounded-2xl backdrop-blur-md">
          {(["all", "Image", "Video"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-5 py-2 rounded-xl text-sm font-bold transition-all",
                filter === f
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20"
                  : "text-white/40 hover:text-white/60 hover:bg-white/5"
              )}
            >
              {f === "all" ? "All" : f === "Image" ? "Photos" : "Videos"}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-white/5 border-t-purple-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center flex-col gap-6 text-center animate-in fade-in zoom-in">
          <div className="w-24 h-24 rounded-3xl bg-white/5 flex items-center justify-center border border-white/10 shadow-2xl">
            <ImageIcon className="w-12 h-12 text-white/20" />
          </div>
          <div className="space-y-2">
            <h3 className="text-white font-black text-2xl tracking-tight">No media found</h3>
            <p className="text-white/40 max-w-sm text-sm font-medium">
              Your Snapchat export may not include media files in the expected locations.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 px-8 pb-8 overflow-hidden">
          <VirtuosoGrid
            style={{ height: "100%" }}
            totalCount={filtered.length}
            overscan={400}
            listClassName="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 pb-10"
            endReached={loadMore}
            itemContent={(index) => {
              const item = filtered[index];
              if (!item) return null;
              return (
                <MediaThumbnail
                  path={item.path}
                  mediaType={item.media_type}
                  status="Downloaded"
                  timestamp={item.timestamp || undefined}
                  onClick={() => setViewerIndex(index)}
                />
              );
            }}
          />
        </div>
      )}

      {/* Loading more indicator */}
      {loadingMore && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 py-2 px-4 rounded-full bg-purple-600/90 text-white text-xs font-bold shadow-2xl backdrop-blur-md flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Loading more...
        </div>
      )}

      <MediaViewer
        isOpen={viewerIndex >= 0}
        onClose={() => setViewerIndex(-1)}
        items={filtered.map((f): MediaViewerItem => ({ ...f, media_path: f.path, media_type: f.media_type }))}
        currentIndex={viewerIndex}
        onIndexChange={setViewerIndex}
      />
    </div>
  );
}

