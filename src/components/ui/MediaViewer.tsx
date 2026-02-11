import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Download, Play, Image as ImageIcon, FolderOpen, MapPin, Calendar, User, AlertCircle } from 'lucide-react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { cn } from '../../lib/utils';
import { MediaViewerItem } from '../../types';

interface MediaViewerProps {
    isOpen: boolean;
    onClose: () => void;
    items: MediaViewerItem[];
    currentIndex: number;
    onIndexChange?: (index: number) => void;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({
    isOpen,
    onClose,
    items,
    currentIndex,
    onIndexChange
}) => {
    const currentItem = items[currentIndex];
    const [showUI, setShowUI] = useState(true);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') handlePrev();
            if (e.key === 'ArrowRight') handleNext();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, currentIndex, items.length]);

    if (!isOpen || !currentItem) return null;

    const handleNext = () => {
        if (currentIndex < items.length - 1) {
            onIndexChange?.(currentIndex + 1);
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            onIndexChange?.(currentIndex - 1);
        }
    };

    const getMediaSrc = (item: MediaViewerItem) => {
        const path = item.media_path || item.path || (item.media_references?.[0]);
        if (path) return convertFileSrc(path);
        return item.download_url || item.proxy_url;
    };

    const getMediaType = (item: MediaViewerItem) => {
        const type = item.media_type || (item.event_type === 'SNAP_VIDEO' ? 'Video' : 'Image');
        return type;
    };

    const src = getMediaSrc(currentItem);
    const type = getMediaType(currentItem).toLowerCase();
    const isVideo = type === 'video' || (src && src.split('?')[0].toLowerCase().endsWith('.mp4'));

    const openInFinder = async () => {
        const path = currentItem.media_path || currentItem.path;
        if (path) {
            await invoke('show_in_folder', { path });
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-100 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center overflow-hidden"
                onClick={() => setShowUI(!showUI)}
            >
                {/* Background Ambient Glow */}
                <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-600 rounded-full blur-[200px]" />
                </div>

                {/* Top bar */}
                <AnimatePresence>
                    {showUI && (
                        <motion.div
                            initial={{ y: -20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -20, opacity: 0 }}
                            className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center bg-linear-to-b from-black/80 to-transparent z-10"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 transition-colors"
                                >
                                    <X className="w-6 h-6 text-white" />
                                </button>
                                <div className="flex flex-col">
                                    <span className="text-white font-semibold flex items-center gap-2">
                                        {isVideo ? <Play className="w-4 h-4 fill-current" /> : <ImageIcon className="w-4 h-4" />}
                                        {items.length > 1 ? `Media ${currentIndex + 1} of ${items.length}` : 'Media Viewer'}
                                    </span>
                                    {currentItem.timestamp && (
                                        <span className="text-white/40 text-xs flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(currentItem.timestamp).toLocaleString()}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {(currentItem.media_path || currentItem.path) && (
                                    <button
                                        onClick={openInFinder}
                                        className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors flex items-center gap-2 text-sm text-white/80"
                                    >
                                        <FolderOpen className="w-5 h-5" />
                                        Show in Finder
                                    </button>
                                )}
                                <button className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 border border-purple-400/30 transition-shadow shadow-lg shadow-purple-500/20 active:scale-95">
                                    <Download className="w-5 h-5 text-white" />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Main content */}
                <div className="relative w-full h-full flex items-center justify-center p-4">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentIndex}
                            initial={{ x: 100, opacity: 0, scale: 0.9 }}
                            animate={{ x: 0, opacity: 1, scale: 1 }}
                            exit={{ x: -100, opacity: 0, scale: 0.9 }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="max-w-full max-h-full flex items-center justify-center"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {src ? (
                                isVideo ? (
                                    <video
                                        src={src}
                                        controls
                                        autoPlay
                                        className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl shadow-black/50 border border-white/10"
                                    />
                                ) : (
                                    <img
                                        src={src}
                                        className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl shadow-black/50 border border-white/10 object-contain"
                                        draggable={false}
                                    />
                                )
                            ) : (
                                <div className="text-white/20 flex flex-col items-center gap-4">
                                    <AlertCircle className="w-20 h-20" />
                                    <p>Media not available locally</p>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {/* Navigation */}
                    {items.length > 1 && showUI && (
                        <>
                            <motion.button
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className={cn(
                                    "absolute left-6 top-1/2 -translate-y-1/2 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-md transition-all group z-20",
                                    currentIndex === 0 && "opacity-20 cursor-not-allowed"
                                )}
                                onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                                disabled={currentIndex === 0}
                            >
                                <ChevronLeft className="w-8 h-8 text-white" />
                            </motion.button>
                            <motion.button
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className={cn(
                                    "absolute right-6 top-1/2 -translate-y-1/2 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-md transition-all group z-20",
                                    currentIndex === items.length - 1 && "opacity-20 cursor-not-allowed"
                                )}
                                onClick={(e) => { e.stopPropagation(); handleNext(); }}
                                disabled={currentIndex === items.length - 1}
                            >
                                <ChevronRight className="w-8 h-8 text-white" />
                            </motion.button>
                        </>
                    )}
                </div>

                {/* Info panel */}
                <AnimatePresence>
                    {showUI && (
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 20, opacity: 0 }}
                            className="absolute bottom-10 left-1/2 -translate-x-1/2 px-8 py-4 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-2xl flex items-center gap-8 z-10"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {currentItem.latitude && (
                                <div className="flex items-center gap-2 text-white/60 text-sm">
                                    <MapPin className="w-4 h-4 text-purple-400" />
                                    <span>{`${currentItem.latitude.toFixed(4)}, ${currentItem.longitude?.toFixed(4)}`}</span>
                                </div>
                            )}
                            {currentItem.media_type && (
                                <div className="flex items-center gap-2 text-white/60 text-sm">
                                    <ImageIcon className="w-4 h-4 text-blue-400" />
                                    <span>{currentItem.media_type}</span>
                                </div>
                            )}
                            {currentItem.sender && (
                                <div className="flex items-center gap-2 text-white/60 text-sm">
                                    <User className="w-4 h-4 text-green-400" />
                                    <span>{currentItem.sender_name || currentItem.sender}</span>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </AnimatePresence>
    );
};
