import { useState, useCallback } from "react";
import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { ask, message } from "@tauri-apps/plugin-dialog";

export function useUpdater() {
  const [checking, setChecking] = useState(false);
  const [update, setUpdate] = useState<Update | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkForUpdates = useCallback(async (silent = false) => {
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
      setError(String(e));
      if (!silent) {
        await message(`Failed to check for updates: ${e}`, {
          title: "Update Error",
          kind: "error",
        });
      }
      return null;
    } finally {
      setChecking(false);
    }
  }, []);

  const installUpdate = useCallback(async () => {
    if (!update) return;

    try {
      const confirm = await ask(
        `A new version (v${update.version}) is ready to install. The app will restart automatically.`,
        {
          title: "Install Update",
          kind: "info",
          okLabel: "Install & Restart",
          cancelLabel: "Not Now",
        }
      );

      if (confirm) {
        await update.downloadAndInstall();
        await relaunch();
      }
    } catch (e) {
      console.error("Failed to install update:", e);
      await message(`Failed to install update: ${e}`, {
        title: "Installation Error",
        kind: "error",
      });
    }
  }, [update]);

  return {
    checking,
    update,
    error,
    checkForUpdates,
    installUpdate,
  };
}
