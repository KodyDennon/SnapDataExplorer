import { useState, useEffect } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export function Updater({ addToast }: { addToast: (type: "info" | "success" | "warning" | "error", message: string) => void }) {
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    async function checkForUpdates() {
      if (checking) return;
      setChecking(true);

      try {
        const update = await check();
        if (update) {
          console.log(`Found update ${update.version} from ${update.date} with notes: ${update.body}`);
          
          addToast("info", `Update available: v${update.version}`);
          
          const confirmUpdate = window.confirm(`A new version (v${update.version}) is available. Would you like to install it now?

${update.body}`);
          
          if (confirmUpdate) {
            addToast("info", "Downloading update...");
            
            await update.downloadAndInstall();

            addToast("success", "Update installed! Restarting...");
            await relaunch();
          }
        }
      } catch (e) {
        console.error("Failed to check for updates:", e);
      } finally {
        setChecking(false);
      }
    }

    // Check on mount
    checkForUpdates();
    
    // Check every 24 hours
    const interval = setInterval(checkForUpdates, 24 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return null;
}

// Note: I need to add @tauri-apps/plugin-process as well for relaunch
