import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { motion, AnimatePresence } from "framer-motion";
import { Memory, MediaEntry } from "../types";
import { cn } from "../lib/utils";
import {
    X,
    Play,
    Maximize2,
    LayoutGrid,
    Zap,
    Wind,
    Layers,
    Calendar,
    Eye,
    ArrowRight
} from "lucide-react";
import { MediaViewer } from "./ui/MediaViewer";

// --- Types ---
interface ChillGalleryProps {
    onExit: () => void;
}

interface UnifiedMedia {
    id: string;
    path: string;
    type: string;
    timestamp: string;
    source: 'local' | 'cloud';
    raw: Memory | MediaEntry;
}

export function ChillGallery({ onExit }: ChillGalleryProps) {
    const [items, setItems] = useState<UnifiedMedia[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewerIndex, setViewerIndex] = useState(-1);
    const [isAutoScrolling, setIsAutoScrolling] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [hoveredItem, setHoveredItem] = useState<UnifiedMedia | null>(null);

    // Load and unify media from local export and cloud memories
    useEffect(() => {
        const fetchUnifiedMedia = async () => {
            try {
                const [allMemories, allLocal] = await Promise.all([
                    invoke<Memory[]>("get_memories"),
                    invoke<MediaEntry[]>("get_all_media", { limit: 1000, offset: 0 })
                ]);

                const unified: UnifiedMedia[] = [
                    ...allMemories
                        .filter(m => m.media_path && (m.media_type === "Image" || m.media_type === "Video"))
                        .map(m => ({
                            id: m.id,
                            path: m.media_path!,
                            type: m.media_type,
                            timestamp: m.timestamp,
                            source: 'cloud' as const,
                            raw: m
                        })),
                    ...allLocal.map(l => ({
                        id: l.path,
                        path: l.path,
                        type: l.media_type,
                        timestamp: l.timestamp || new Date().toISOString(),
                        source: 'local' as const,
                        raw: l
                    }))
                ];

                // Sort by timestamp descending
                setItems(unified.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
            } catch (err) {
                console.error("Unified Gallery failed:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchUnifiedMedia();
    }, []);

    // Ambient Auto-Scrolling
    useEffect(() => {
        let animationFrame: number;
        const scroll = () => {
            if (isAutoScrolling && scrollRef.current) {
                scrollRef.current.scrollTop += 0.4; // Very slow drift
                if (scrollRef.current.scrollTop >= scrollRef.current.scrollHeight - scrollRef.current.clientHeight) {
                    setIsAutoScrolling(false);
                }
            }
            animationFrame = requestAnimationFrame(scroll);
        };
        animationFrame = requestAnimationFrame(scroll);
        return () => cancelAnimationFrame(animationFrame);
    }, [isAutoScrolling]);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-zinc-950">
                <div className="flex flex-col items-center gap-6">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-white/5 border-t-brand-500 rounded-full animate-spin" />
                        <Layers className="absolute inset-0 m-auto w-6 h-6 text-brand-500 animate-pulse" />
                    </div>
                    <p className="text-white/40 font-mono text-[10px] uppercase tracking-[0.4em] animate-pulse">Syncing Visual Stream...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative flex-1 bg-zinc-950 flex flex-col h-full overflow-hidden font-sans">
            {/* Immersive Animated Background */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={hoveredItem?.id || 'default'}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.25 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.2, ease: "easeInOut" }}
                    className="absolute inset-0 pointer-events-none z-0"
                >
                    <div
                        className="absolute inset-0 bg-cover bg-center blur-[140px] scale-150 transition-all duration-1000"
                        style={{ backgroundImage: hoveredItem ? `url(asset://${hoveredItem.path})` : 'none' }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-tr from-zinc-950 via-transparent to-zinc-950/50" />
                </motion.div>
            </AnimatePresence>

            {/* Floating Header Controls */}
            <div className="absolute inset-x-0 top-0 z-40 p-8 flex justify-between items-center bg-gradient-to-b from-zinc-950/80 to-transparent backdrop-blur-[2px]">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-4"
                >
                    <div className="w-10 h-10 rounded-2xl bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
                        <Wind className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-white text-xl font-black tracking-tighter leading-none">GALLERY</h1>
                        <p className="text-white/30 text-[9px] uppercase tracking-[0.4em] mt-1 font-bold">Immersive View</p>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex gap-3"
                >
                    <button
                        onClick={() => setIsAutoScrolling(!isAutoScrolling)}
                        className={cn(
                            "px-5 py-2.5 rounded-2xl border text-[10px] font-black tracking-widest transition-all flex items-center gap-3",
                            isAutoScrolling
                                ? "bg-brand-500 border-brand-400 text-white shadow-xl shadow-brand-500/40"
                                : "bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/10"
                        )}
                    >
                        <div className={cn("w-2 h-2 rounded-full", isAutoScrolling ? "bg-white animate-ping" : "bg-white/20")} />
                        {isAutoScrolling ? "ZEN MODE ON" : "ZEN MODE OFF"}
                    </button>

                    <button
                        onClick={onExit}
                        className="group flex items-center gap-3 bg-white/5 hover:bg-white/15 border border-white/10 px-6 py-2.5 rounded-2xl transition-all duration-500"
                    >
                        <span className="text-white/60 group-hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors">Exit Chill</span>
                        <X className="w-4 h-4 text-white/40 group-hover:text-white group-hover:rotate-90 transition-all duration-500" />
                    </button>
                </motion.div>
            </div>

            {/* Grid Container */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto no-scrollbar pt-32 pb-32 px-6 md:px-12 z-10"
            >
                <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6 gap-6 relative">
                    {items.map((item, i) => (
                        <div key={item.id} className="mb-6 break-inside-avoid">
                            <GalleryItem
                                item={item}
                                index={i}
                                onClick={() => setViewerIndex(i)}
                                onMouseEnter={() => setHoveredItem(item)}
                                onMouseLeave={() => setHoveredItem(null)}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Master Media Viewer */}
            <MediaViewer
                isOpen={viewerIndex >= 0}
                onClose={() => setViewerIndex(-1)}
                items={items.map(i => i.raw)}
                currentIndex={viewerIndex}
                onIndexChange={setViewerIndex}
            />

            {/* Bottom Status Bar */}
            <div className="absolute inset-x-0 bottom-0 z-40 p-6 flex justify-center pointer-events-none">
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="px-6 py-3 rounded-2xl bg-zinc-900/80 border border-white/10 backdrop-blur-xl pointer-events-auto flex items-center gap-8 shadow-2xl"
                >
                    <div className="flex items-center gap-3">
                        <LayoutGrid className="w-4 h-4 text-brand-500" />
                        <span className="text-white text-xs font-bold tracking-tight">{items.length} Elements Discovered</span>
                    </div>
                    <div className="w-px h-4 bg-white/10" />
                    <div className="flex items-center gap-3 group cursor-help">
                        <Eye className="w-4 h-4 text-blue-400" />
                        <span className="text-white/60 text-[10px] font-medium uppercase tracking-wider group-hover:text-white transition-colors">Forensic Parallax Enabled</span>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

function GalleryItem({
    item,
    index,
    onClick,
    onMouseEnter,
    onMouseLeave
}: {
    item: UnifiedMedia,
    index: number,
    onClick: () => void,
    onMouseEnter: () => void,
    onMouseLeave: () => void
}) {
    const src = `asset://${item.path}`;

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: (index % 12) * 0.03 }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onClick={onClick}
            className="group relative rounded-3xl overflow-hidden cursor-pointer bg-zinc-900 border border-white/10 hover:border-brand-500/50 transition-all duration-700 shadow-xl hover:shadow-brand-500/20"
        >
            {/* Glow Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-40 group-hover:opacity-80 transition-opacity duration-700 z-10" />

            {/* Media */}
            {item.type === "Video" ? (
                <div className="w-full relative overflow-hidden">
                    <video
                        src={src}
                        className="w-full h-auto object-cover group-hover:scale-110 transition-transform duration-[2000ms] ease-out"
                        muted
                        loop
                        onMouseOver={e => e.currentTarget.play()}
                        onMouseOut={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                    />
                    <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-xl rounded-full p-2.5 z-20 border border-white/10 group-hover:bg-brand-500 transition-colors">
                        <Play className="w-3 h-3 text-white fill-current" />
                    </div>
                </div>
            ) : (
                <img
                    src={src}
                    className="w-full h-auto object-cover group-hover:scale-110 transition-transform duration-[2000ms] ease-out"
                    alt=""
                    loading="lazy"
                />
            )}

            {/* Info Labels */}
            <div className="absolute inset-0 p-5 z-20 flex flex-col justify-between opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-2 group-hover:translate-y-0">
                <div className="flex justify-between items-start">
                    <div className="px-2 py-1 rounded-lg bg-zinc-950/60 backdrop-blur-md border border-white/10">
                        <span className="text-[8px] font-black text-white/50 uppercase tracking-widest">{item.source}</span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-zinc-950 shadow-xl scale-0 group-hover:scale-100 transition-transform duration-500 delay-100">
                        <ArrowRight className="w-4 h-4" />
                    </div>
                </div>

                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-3 h-3 text-brand-400" />
                        <p className="text-white font-bold text-[11px] tracking-tight">
                            {new Date(item.timestamp).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={cn("w-1.5 h-1.5 rounded-full", item.type === 'Video' ? 'bg-amber-400' : 'bg-blue-400')} />
                        <p className="text-white/40 text-[9px] font-black uppercase tracking-[0.2em]">
                            {item.type} • {item.source === 'cloud' ? 'Downloaded' : 'Export File'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Shimmer on Hover */}
            <div className="absolute inset-0 -translate-x-[200%] group-hover:translate-x-[200%] transition-transform duration-[1500ms] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none z-30" />
        </motion.div>
    );
}
