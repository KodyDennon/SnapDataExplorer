import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { VirtuosoGrid } from "react-virtuoso";
import { MediaEntry } from "../types";

function GalleryFallback({ type }: { type: "image" | "video" }) {
  return (
    <div className="w-full h-full bg-slate-300 dark:bg-slate-700 flex items-center justify-center absolute inset-0">
      <span className="text-3xl">{type === "video" ? "\u{25B6}\uFE0F" : "\u{1F5BC}\uFE0F"}</span>
    </div>
  );
}

const PAGE_SIZE = 200;

export function GalleryView() {
  const [media, setMedia] = useState<MediaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lightboxItem, setLightboxItem] = useState<MediaEntry | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [filter, setFilter] = useState<"all" | "Image" | "Video">("all");
  const [failedMedia, setFailedMedia] = useState<Set<string>>(new Set());
  const offsetRef = useRef(0);

  const loadMedia = useCallback(async (append = false) => {
    if (!append) {
      setLoading(true);
      offsetRef.current = 0;
    } else {
      setLoadingMore(true);
    }
    try {
      const data = await invoke<MediaEntry[]>("get_all_media", {
        limit: PAGE_SIZE,
        offset: offsetRef.current,
      });
      if (append) {
        setMedia(prev => [...prev, ...data]);
      } else {
        setMedia(data);
      }
      offsetRef.current += data.length;
      setHasMore(data.length === PAGE_SIZE);
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

  const filtered = filter === "all" ? media : media.filter(m => m.media_type === filter);

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

  function openLightbox(item: MediaEntry) {
    const idx = filtered.indexOf(item);
    setLightboxItem(item);
    setLightboxIndex(idx);
  }

  function navigateLightbox(dir: -1 | 1) {
    const newIdx = lightboxIndex + dir;
    if (newIdx >= 0 && newIdx < filtered.length) {
      setLightboxItem(filtered[newIdx]);
      setLightboxIndex(newIdx);
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 h-full">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-8 py-6 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Media Gallery</h1>
          <p className="text-sm text-slate-400 mt-1">
            {filtered.length} items{hasMore ? "+" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {(["all", "Image", "Video"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                filter === f
                  ? "bg-slate-900 dark:bg-slate-700 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {f === "all" ? "All" : f === "Image" ? "Photos" : "Videos"}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-slate-200 dark:border-slate-700 border-t-slate-900 dark:border-t-slate-300 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center flex-col gap-4 px-8 text-center">
          <span className="text-6xl">{"\u{1F5BC}\uFE0F"}</span>
          <p className="text-slate-400 font-bold text-lg">No media files found</p>
          <p className="text-slate-300 dark:text-slate-600 max-w-md">
            Your Snapchat export may not include media files. When requesting your data from Snapchat, make sure to select "Include Media / Attachments" to get the actual images and videos.
          </p>
        </div>
      ) : (
        <VirtuosoGrid
          style={{ height: "100%" }}
          totalCount={filtered.length}
          overscan={200}
          listClassName="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1 p-2"
          endReached={loadMore}
          itemContent={(index) => {
            const item = filtered[index];
            if (!item) return null;
            return (
              <button
                onClick={() => openLightbox(item)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openLightbox(item); } }}
                className="relative aspect-square overflow-hidden rounded-lg group bg-slate-200 dark:bg-slate-800"
                aria-label={`${isImageFile(item.path) ? "Photo" : "Video"} from ${item.timestamp ? new Date(item.timestamp).toLocaleDateString() : "unknown date"}`}
              >
                {failedMedia.has(item.path) ? (
                  <GalleryFallback type={isImageFile(item.path) ? "image" : "video"} />
                ) : isImageFile(item.path) ? (
                  <img
                    src={getMediaSrc(item.path)}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    loading="lazy"
                    onError={() => setFailedMedia(prev => { const next = new Set(prev); next.add(item.path); return next; })}
                  />
                ) : (
                  <video
                    src={getMediaSrc(item.path)}
                    preload="metadata"
                    muted
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    onLoadedData={(e) => {
                      (e.target as HTMLVideoElement).currentTime = 0.1;
                    }}
                    onError={() => setFailedMedia(prev => { const next = new Set(prev); next.add(item.path); return next; })}
                  />
                )}
                {!isImageFile(item.path) && (
                  <div className="absolute top-2 left-2 bg-black/60 rounded-full w-6 h-6 flex items-center justify-center">
                    <span className="text-xs text-white">{"\u{25B6}"}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[9px] text-white font-bold">
                    {item.timestamp ? new Date(item.timestamp).toLocaleDateString() : ""}
                  </p>
                  <p className="text-[8px] text-white/70 uppercase">{item.source}</p>
                </div>
              </button>
            );
          }}
        />
      )}

      {loadingMore && (
        <div className="py-4 flex justify-center">
          <div className="w-6 h-6 border-3 border-slate-200 dark:border-slate-700 border-t-slate-900 dark:border-t-slate-300 rounded-full animate-spin" />
        </div>
      )}

      {lightboxItem && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          role="dialog"
          aria-label="Media lightbox"
          onClick={() => setLightboxItem(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setLightboxItem(null);
            if (e.key === "ArrowLeft" && lightboxIndex > 0) navigateLightbox(-1);
            if (e.key === "ArrowRight" && lightboxIndex < filtered.length - 1) navigateLightbox(1);
          }}
          tabIndex={0}
          ref={(el) => el?.focus()}
        >
          <button
            className="absolute top-6 right-6 text-white/60 hover:text-white text-3xl font-bold z-10"
            onClick={() => setLightboxItem(null)}
          >
            {"\u{2715}"}
          </button>

          {lightboxIndex > 0 && (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-4xl font-bold z-10 p-2"
              onClick={(e) => { e.stopPropagation(); navigateLightbox(-1); }}
            >
              {"\u{2039}"}
            </button>
          )}

          {lightboxIndex < filtered.length - 1 && (
            <button
              className="absolute right-16 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-4xl font-bold z-10 p-2"
              onClick={(e) => { e.stopPropagation(); navigateLightbox(1); }}
            >
              {"\u{203A}"}
            </button>
          )}

          <div
            className="max-w-[90vw] max-h-[90vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {isImageFile(lightboxItem.path) ? (
              <img
                src={getMediaSrc(lightboxItem.path)}
                alt=""
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
              />
            ) : (
              <video
                src={getMediaSrc(lightboxItem.path)}
                controls
                autoPlay
                className="max-w-full max-h-[90vh] rounded-lg"
              />
            )}
          </div>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/60 text-sm text-center">
            <p>{lightboxItem.timestamp ? new Date(lightboxItem.timestamp).toLocaleString() : "Unknown date"}</p>
            <p className="text-white/40 text-xs mt-1">
              {lightboxItem.source}
              {lightboxIndex >= 0 && ` \u{2022} ${lightboxIndex + 1} of ${filtered.length}`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
