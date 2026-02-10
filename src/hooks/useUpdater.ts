import { useState, useCallback } from "react";
import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { ask, message } from "@tauri-apps/plugin-dialog";

export interface DownloadProgress {
  downloaded: number;
  total?: number;
  percent: number;
}

export function useUpdater() {
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [update, setUpdate] = useState<Update | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkForUpdates = useCallback(async (silent = false) => {
    if (checking || downloading) return null;
    
    setChecking(true);
    setError(null);
    try {
      const result = await check();
      setUpdate(result);
      if (!result && !silent) {
        await message("You are running the latest version of Snap Data Explorer.", {
          title: "No Updates Available",
          kind: "info",
        });
      }
      return result;
    } catch (e) {
      console.error("Failed to check for updates:", e);
      const msg = String(e);
      setError(msg);
      if (!silent) {
        await message(`Failed to check for updates: ${msg}`, {
          title: "Update Error",
          kind: "error",
        });
      }
      return null;
    } finally {
      setChecking(false);
    }
  }, [checking, downloading]);

  const installUpdate = useCallback(async () => {
    if (!update || downloading) return;

    try {
      const confirm = await ask(
        `A new version (v${update.version}) is available. It is recommended to update for the latest features and security fixes.\n\nRelease Notes:\n${update.body || "No notes provided."}`,
        {
          title: "Install Update",
          kind: "info",
          okLabel: "Update Now",
          cancelLabel: "Later",
        }
      );

      if (!confirm) return;

      setDownloading(true);
      setError(null);
      
      let downloaded = 0;
      let total = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            total = event.data.contentLength || 0;
            setProgress({ downloaded: 0, total, percent: 0 });
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            const percent = total > 0 ? (downloaded / total) * 100 : 0;
            setProgress({ downloaded, total, percent });
            break;
          case 'Finished':
            setProgress({ downloaded, total, percent: 100 });
            break;
        }
      });

      // Brief delay to show 100% before restart
      await new Promise(resolve => setTimeout(resolve, 800));
      await relaunch();
    } catch (e) {
      console.error("Failed to install update:", e);
      setDownloading(false);
      setProgress(null);
      setError(String(e));
      await message(`Failed to install update: ${e}`, {
        title: "Installation Error",
        kind: "error",
      });
    }
  }, [update, downloading]);

  return {
    checking,
    downloading,
    progress,
    update,
    error,
    checkForUpdates,
    installUpdate,
  };
}