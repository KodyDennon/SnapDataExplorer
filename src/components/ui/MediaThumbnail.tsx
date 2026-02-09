import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Image as ImageIcon, Cloud, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { cn } from '../../lib/utils';
import { DownloadStatus, DownloadProgress } from '../../types';

interface MediaThumbnailProps {
    path?: string;
    remoteUrl?: string;
    mediaType: string; // "Image" | "Video"
    status: DownloadStatus;
    progress?: DownloadProgress;
    isSelected?: boolean;
    onSelect?: (selected: boolean) => void;
    onClick?: () => void;
    className?: string;
    timestamp?: string;
}

export const MediaThumbnail: React.FC<MediaThumbnailProps> = ({
    path,
    remoteUrl,
    mediaType,
    status,
    progress,
    isSelected,
    onSelect,
    onClick,
    className,
    timestamp
}) => {
    const [hasError, setHasError] = useState(false);
    const isVideo = mediaType.toLowerCase() === 'video';

    const src = path ? convertFileSrc(path) : remoteUrl;

    const renderStatusIcon = () => {
        switch (status) {
            case 'Pending':
                return <Cloud className="w-4 h-4 text-blue-400" />;
            case 'Downloading':
                return <Clock className="w-4 h-4 text-yellow-400 animate-pulse" />;
            case 'Downloaded':
                return <CheckCircle className="w-4 h-4 text-green-400" />;
            case 'Failed':
                return <AlertCircle className="w-4 h-4 text-red-400" />;
            default:
                return null;
        }
    };

    return (
        <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
                "relative rounded-xl overflow-hidden aspect-square cursor-pointer group bg-black/40 border border-white/5 shadow-2xl transition-all duration-300",
                isSelected && "ring-2 ring-purple-500 ring-offset-2 ring-offset-zinc-950",
                className
            )}
            onClick={onClick}
        >
            {/* Media Content */}
            {src && !hasError ? (
                isVideo ? (
                    <video
                        src={src}
                        className="w-full h-full object-cover"
                        onMouseOver={(e) => {
                            if (status === 'Downloaded') e.currentTarget.play().catch(() => { });
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.pause();
                            e.currentTarget.currentTime = 0;
                        }}
                        muted
                        loop
                        playsInline
                        onError={() => setHasError(true)}
                    />
                ) : (
                    <img
                        src={src}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={() => setHasError(true)}
                    />
                )
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900/50 backdrop-blur-sm text-zinc-500 gap-2">
                    {isVideo ? <Play className="w-8 h-8 opacity-20" /> : <ImageIcon className="w-8 h-8 opacity-20" />}
                    {status === 'Pending' && <span className="text-[10px] uppercase font-bold tracking-tighter opacity-40">Remote</span>}
                </div>
            )}

            {/* Overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-300" />

            {/* Progress Bar for Downloads */}
            {status === 'Downloading' && progress && (
                <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress.progress * 100}%` }}
                        className="h-full bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]"
                    />
                </div>
            )}

            {/* Top Bar: Selection & Status */}
            <div className="absolute top-2 left-2 right-2 flex justify-between items-start">
                <div
                    onClick={(e) => {
                        e.stopPropagation();
                        onSelect?.(!isSelected);
                    }}
                    className={cn(
                        "w-5 h-5 rounded-full border border-white/20 flex items-center justify-center transition-colors",
                        isSelected ? "bg-purple-600 border-purple-500" : "bg-black/40 hover:bg-black/60"
                    )}
                >
                    {isSelected && <div className="w-2 h-2 rounded-full bg-white shadow-sm" />}
                </div>

                <div className="p-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 shadow-lg">
                    {renderStatusIcon()}
                </div>
            </div>

            {/* Bottom info */}
            <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center transform translate-y-1 group-hover:translate-y-0 transition-transform duration-300">
                {timestamp && (
                    <span className="text-[10px] text-white/60 font-medium truncate max-w-[70%]">
                        {new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}
                    </span>
                )}
                {isVideo && (
                    <div className="p-1 rounded-md bg-white/10 backdrop-blur-sm border border-white/10">
                        <Play className="w-3 h-3 text-white fill-white" />
                    </div>
                )}
            </div>
        </motion.div>
    );
};
