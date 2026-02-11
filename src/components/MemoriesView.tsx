import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Cloud,
    Download,
    Settings,
    Search,
    Filter,
    RefreshCw,
    CheckCircle2,
    Clock,
    AlertCircle,
    FolderOpen
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { Memory, DownloadStatus, DownloadProgress, DiskSpaceInfo } from '../types';
import { MediaThumbnail } from './ui/MediaThumbnail';
import { MediaViewer } from './ui/MediaViewer';
import { cn } from '../lib/utils';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

export const MemoriesView: React.FC = () => {
    const [memories, setMemories] = useState<Memory[]>([]);
    const [loading, setLoading] = useState(true);
    const [storagePath, setStoragePath] = useState<string | null>(null);
    const [diskInfo, setDiskInfo] = useState<DiskSpaceInfo | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterStatus, setFilterStatus] = useState<DownloadStatus | 'All'>('All');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [progress, setProgress] = useState<Record<string, DownloadProgress>>({});

    // Viewer state
    const [viewerIndex, setViewerIndex] = useState<number>(-1);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [allMemories, savedPath] = await Promise.all([
                invoke<Memory[]>("get_memories"),
                invoke<string | null>("get_storage_path")
            ]);
            setMemories(allMemories);
            setStoragePath(savedPath);

            if (savedPath) {
                const info = await invoke<DiskSpaceInfo>("check_disk_space", { path: savedPath });
                setDiskInfo(info);
            }
        } catch (e) {
            console.error("Failed to load memories data:", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();

        const unlisten = listen<DownloadProgress>("download-progress", (event) => {
            setProgress(prev => ({
                ...prev,
                [event.payload.memory_id]: event.payload
            }));

            if (event.payload.status === 'Downloaded') {
                // Refresh memories to get new paths
                loadData();
            }
        });

        return () => {
            unlisten.then(f => f());
        };
    }, [loadData]);

    const handleSelectPath = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: "Select Storage Location for Memories"
            });

            if (selected && typeof selected === 'string') {
                await invoke("set_storage_path", { path: selected });
                setStoragePath(selected);
                const info = await invoke<DiskSpaceInfo>("check_disk_space", { path: selected });
                setDiskInfo(info);
            }
        } catch (e) {
            console.error("Failed to set storage path:", e);
        }
    };

    const startDownload = async (memory?: Memory) => {
        if (!storagePath) {
            alert("Please select a storage path first in settings.");
            return;
        }

        try {
            if (memory) {
                await invoke("download_memory", { memory });
            } else {
                await invoke("download_all_memories");
            }
        } catch (e) {
            console.error("Download failed:", e);
        }
    };

    const filteredMemories = memories.filter(m => {
        const matchesSearch = searchQuery === "" || m.id.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = filterStatus === 'All' || m.download_status === filterStatus;
        return matchesSearch && matchesFilter;
    });

    const stats = {
        total: memories.length,
        downloaded: memories.filter(m => m.download_status === 'Downloaded').length,
        pending: memories.filter(m => m.download_status === 'Pending').length,
        downloadedCount: memories.filter(m => m.download_status === 'Downloaded').length,
        failed: memories.filter(m => m.download_status === 'Failed').length,
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-zinc-950/20 backdrop-blur-xs overflow-hidden p-8 gap-8">
            {/* Header */}
            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-4">
                        Memories
                        <div className="flex gap-2">
                            <span className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold uppercase tracking-wider">
                                {stats.downloadedCount} Downloaded
                            </span>
                            <span className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider">
                                {stats.pending} Pending
                            </span>
                        </div>
                    </h1>
                    <p className="text-white/40 font-medium mt-2">Manage and download your Snapchat memory history locally.</p>
                </div>

                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={loadData}
                        className="bg-white/5 border-white/10 hover:bg-white/10"
                    >
                        <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
                        Refresh
                    </Button>
                    <Button
                        onClick={() => startDownload()}
                        disabled={stats.pending === 0}
                        className="bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 border-none shadow-lg shadow-purple-500/20"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Download All ({stats.pending})
                    </Button>
                </div>
            </header>

            {/* Main Grid */}
            <div className="flex-1 grid grid-cols-12 gap-8 overflow-hidden">

                {/* Left: Controls & Stats */}
                <div className="col-span-3 flex flex-col gap-6 overflow-y-auto no-scrollbar pb-10">

                    {/* Storage Settings */}
                    <Card className="bg-white/5 border-white/10 p-5 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <Settings className="w-4 h-4 text-purple-400" />
                                Storage Settings
                            </h3>
                        </div>

                        <div className="space-y-3">
                            <p className="text-xs text-white/40 font-medium">Download Location</p>
                            <div
                                onClick={handleSelectPath}
                                className="p-3 rounded-xl bg-black/40 border border-white/5 hover:border-purple-500/30 cursor-pointer transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <FolderOpen className="w-5 h-5 text-purple-500 group-hover:scale-110 transition-transform" />
                                    <span className="text-xs text-white group-hover:text-purple-400 font-medium truncate">
                                        {storagePath ? storagePath : "Click to select path..."}
                                    </span>
                                </div>
                            </div>

                            {diskInfo && (
                                <div className="mt-4 space-y-2">
                                    <div className="flex justify-between text-[10px] font-bold text-white/40 uppercase tracking-widest">
                                        <span>Available Space</span>
                                        <span>{Math.round(diskInfo.available_bytes / (1024 * 1024 * 1024))} GB</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(diskInfo.total_bytes - diskInfo.available_bytes) / diskInfo.total_bytes * 100}%` }}
                                            className="h-full bg-purple-500"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Filters */}
                    <Card className="bg-white/5 border-white/10 p-5 flex flex-col gap-4">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <Filter className="w-4 h-4 text-blue-400" />
                            Filters
                        </h3>

                        <div className="space-y-2">
                            {(['All', 'Pending', 'Downloading', 'Downloaded', 'Failed'] as const).map(status => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={cn(
                                        "w-full flex items-center justify-between p-3 rounded-xl text-xs font-semibold transition-all",
                                        filterStatus === status
                                            ? "bg-white/10 text-white border border-white/10 shadow-lg"
                                            : "text-white/40 hover:bg-white/5 border border-transparent"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        {status === 'All' && <Cloud className="w-4 h-4" />}
                                        {status === 'Pending' && <Cloud className="w-4 h-4 text-blue-400" />}
                                        {status === 'Downloading' && <Clock className="w-4 h-4 text-yellow-400" />}
                                        {status === 'Downloaded' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                                        {status === 'Failed' && <AlertCircle className="w-4 h-4 text-red-400" />}
                                        {status}
                                    </div>
                                    <span className="opacity-40">{memories.filter(m => status === 'All' || m.download_status === status).length}</span>
                                </button>
                            ))}
                        </div>
                    </Card>
                </div>

                {/* Right: Gallery Grid */}
                <div className="col-span-9 flex flex-col gap-6 h-full overflow-hidden">

                    {/* Toolbar */}
                    <div className="flex gap-4">
                        <div className="flex-1 relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-purple-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search by ID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500/50 transition-all"
                            />
                        </div>
                        {selectedIds.size > 0 && (
                            <Button
                                onClick={() => {
                                    const selectedMemories = memories.filter(m => selectedIds.has(m.id));
                                    selectedMemories.forEach(m => startDownload(m));
                                }}
                                className="bg-purple-600 hover:bg-purple-500 text-white px-6 rounded-2xl"
                            >
                                Download Selected ({selectedIds.size})
                            </Button>
                        )}
                    </div>

                    {/* Grid */}
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-10">
                        <div className="grid grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                            <AnimatePresence>
                                {filteredMemories.map((memory) => {
                                    return (
                                        <MediaThumbnail
                                            key={memory.id}
                                            path={memory.media_path || undefined}
                                            remoteUrl={memory.download_url || undefined}
                                            mediaType={memory.media_type}
                                            status={memory.download_status}
                                            progress={progress[memory.id]}
                                            timestamp={memory.timestamp}
                                            isSelected={selectedIds.has(memory.id)}
                                            onSelect={(selected) => {
                                                const next = new Set(selectedIds);
                                                if (selected) next.add(memory.id);
                                                else next.delete(memory.id);
                                                setSelectedIds(next);
                                            }}
                                            onClick={() => setViewerIndex(memories.indexOf(memory))}
                                            className="animate-in fade-in zoom-in duration-300"
                                        />
                                    );
                                })}
                            </AnimatePresence>
                        </div>

                        {!loading && filteredMemories.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-64 text-white/20">
                                <AlertCircle className="w-16 h-16 mb-4 opacity-50" />
                                <p className="font-bold text-lg">No memories found matching your filters.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <MediaViewer
                isOpen={viewerIndex >= 0}
                onClose={() => setViewerIndex(-1)}
                items={memories}
                currentIndex={viewerIndex}
                onIndexChange={setViewerIndex}
            />
        </div>
    );
};
