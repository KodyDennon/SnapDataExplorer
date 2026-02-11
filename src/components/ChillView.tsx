import { useState, useEffect, useCallback } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { motion, AnimatePresence } from "framer-motion";
import { Memory } from "../types";
import { Play, Pause, SkipForward, SkipBack, Shuffle } from "lucide-react";

// --- Types ---
type ViewState = "loading" | "playing" | "paused" | "empty";

interface ChillViewProps {
    onExit: () => void;
}

export function ChillView({ onExit }: ChillViewProps) {
    const [memories, setMemories] = useState<Memory[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [viewState, setViewState] = useState<ViewState>("loading");
    const [showControls, setShowControls] = useState(false);
    const [autoPlay, setAutoPlay] = useState(true);

    // Load memories on mount
    useEffect(() => {
        loadMemories();
    }, []);

    const loadMemories = async () => {
        try {
            const allMemories = await invoke<Memory[]>("get_memories");
            // Filter for only media that exists visually (images/videos)
            const visualMemories = allMemories.filter(m =>
                (m.media_type === "Image" || m.media_type === "Video") &&
                (m.media_path || m.download_url)
            );

            // Shuffle for "Chill" vibes
            const shuffled = visualMemories.sort(() => Math.random() - 0.5);

            setMemories(shuffled);
            setViewState(shuffled.length > 0 ? "playing" : "empty");
        } catch (e) {
            console.error("Failed to load Chill memories:", e);
            setViewState("empty");
        }
    };

    // Auto-advance timer
    useEffect(() => {
        let interval: ReturnType<typeof setTimeout>;

        if (viewState === "playing" && autoPlay && memories.length > 0) {
            const currentMemory = memories[currentIndex];
            // Default timing: 5s for images, videos handle their own duration if possible, but for simplicity 10s
            const duration = currentMemory.media_type === "Video" ? 15000 : 5000;

            interval = setTimeout(() => {
                handleNext();
            }, duration);
        }

        return () => clearTimeout(interval);
    }, [viewState, autoPlay, currentIndex, memories]);

    const handleNext = useCallback(() => {
        setCurrentIndex((prev) => (prev + 1) % memories.length);
    }, [memories.length]);

    const handlePrev = useCallback(() => {
        setCurrentIndex((prev) => (prev - 1 + memories.length) % memories.length);
    }, [memories.length]);

    const togglePlay = () => {
        setViewState(prev => prev === "playing" ? "paused" : "playing");
        setAutoPlay(prev => !prev);
    };

    if (viewState === "loading") {
        return (
            <div className="flex-1 flex items-center justify-center bg-black">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    if (viewState === "empty" || memories.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-black text-white p-8 text-center">
                <h2 className="text-3xl font-bold mb-4">No Memories Found</h2>
                <p className="text-white/60 max-w-md">
                    "Chill Mode" needs memories to display. Try importing a Snapchat export with media files.
                </p>
            </div>
        );
    }

    const currentMemory = memories[currentIndex];
    // Prefer local path, fallback to remote
    const mediaSrc = currentMemory.media_path
        ? convertFileSrc(currentMemory.media_path)
        : currentMemory.download_url ?? undefined;

    return (
        <div
            className="relative flex-1 bg-black overflow-hidden group h-full"
            onMouseEnter={() => setShowControls(true)}
            onMouseLeave={() => setShowControls(false)}
        >
            {/* Main Content Layer */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentMemory.id}
                    initial={{ opacity: 0, scale: 1.1 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8 }}
                    className="absolute inset-0 flex items-center justify-center"
                >
                    {/* Background Blur */}
                    <div
                        className="absolute inset-0 bg-cover bg-center opacity-30 blur-3xl scale-125"
                        style={{ backgroundImage: `url(${mediaSrc})` }}
                    />

                    {/* Media Content */}
                    <div className="relative z-10 max-h-full max-w-full p-4 md:p-12 flex items-center justify-center">
                        {currentMemory.media_type === "Video" ? (
                            <video
                                src={mediaSrc}
                                className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl"
                                autoPlay={viewState === "playing"}
                                loop
                                muted={false}
                                playsInline
                            />
                        ) : (
                            <img
                                src={mediaSrc}
                                alt="Memory"
                                className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl object-contain"
                            />
                        )}
                    </div>
                </motion.div>
            </AnimatePresence>

            {/* Info Overlay (Top Left) */}
            <div className="absolute top-8 left-8 z-20">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-left"
                >
                    <p className="text-xs font-bold text-white/60 uppercase tracking-widest mb-1">
                        {new Date(currentMemory.timestamp).toLocaleDateString(undefined, {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })}
                    </p>
                    <p className="text-white text-sm font-mono opacity-80">
                        {new Date(currentMemory.timestamp).toLocaleTimeString()}
                    </p>
                    {currentMemory.latitude && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-white/50">
                            <span>📍</span>
                            <span>{currentMemory.latitude.toFixed(4)}, {currentMemory.longitude?.toFixed(4)}</span>
                        </div>
                    )}
                </motion.div>
            </div>

            {/* Progress Bar (Top) */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-white/10 z-30">
                <motion.div
                    className="h-full bg-purple-500"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    key={currentIndex} // Reset on change
                    transition={{
                        duration: currentMemory.media_type === "Video" ? 15 : 5,
                        ease: "linear"
                    }}
                />
            </div>

            {/* Controls (Bottom) */}
            <motion.div
                className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 flex items-center gap-6 bg-black/50 backdrop-blur-xl border border-white/10 px-8 py-4 rounded-full"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: showControls || viewState === "paused" ? 1 : 0, y: showControls || viewState === "paused" ? 0 : 20 }}
            >
                <button onClick={handlePrev} className="text-white/60 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full">
                    <SkipBack className="w-6 h-6" />
                </button>

                <button
                    onClick={togglePlay}
                    className="bg-white text-black p-4 rounded-full hover:scale-105 transition-transform"
                >
                    {viewState === "playing" ? (
                        <Pause className="w-6 h-6 fill-current" />
                    ) : (
                        <Play className="w-6 h-6 fill-current ml-1" />
                    )}
                </button>

                <button onClick={handleNext} className="text-white/60 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full">
                    <SkipForward className="w-6 h-6" />
                </button>

                <div className="w-px h-8 bg-white/10 mx-2" />

                <button
                    onClick={loadMemories} // Reshuffle
                    className="text-white/60 hover:text-purple-400 transition-colors p-2 hover:bg-white/10 rounded-full group"
                    title="Shuffle"
                >
                    <Shuffle className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
                </button>

                <div className="w-px h-8 bg-white/10 mx-2" />

                <button
                    onClick={onExit}
                    className="text-white/60 hover:text-red-400 transition-colors p-2 hover:bg-white/10 rounded-full flex items-center gap-2 px-4"
                    title="Exit Chill Mode"
                >
                    <span className="text-xs font-bold uppercase tracking-wider">Exit</span>
                </button>
            </motion.div>
        </div>
    );
}
