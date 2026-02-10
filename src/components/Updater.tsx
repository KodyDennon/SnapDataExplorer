import { useState, useEffect } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { ask } from "@tauri-apps/plugin-dialog";

export function Updater({ addToast }: { addToast: (type: "info" | "success" | "warning" | "error", message: string) => void }) {
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    async function checkForUpdates() {
      if (checking) return;
      setChecking(true);

      try {
        const update = await check();
        if (update) {
          console.log(`Found update ${update.version} from ${update.date}`);
          
          const confirmUpdate = await ask(
            `A new version (v${update.version}) is available. It is recommended to update for the latest features and security fixes.\n\nRelease Notes:\n${update.body || "No notes provided."}`,
            { 
              title: "Update Available",
              kind: "info",
              okLabel: "Update Now",
              cancelLabel: "Later"
            }
          );
          
          if (confirmUpdate) {
            addToast("info", "Downloading and installing update... the app will restart automatically.");
            
            try {
              await update.downloadAndInstall();
              addToast("success", "Update installed! Restarting...");
              await relaunch();
            } catch (err) {
              console.error("Installation failed:", err);
              addToast("error", `Failed to install update: ${err}`);
            }
          }
        }
      } catch (e) {
        console.error("Failed to check for updates:", e);
      } finally {
        setChecking(false);
      }
    }

    // Delay check slightly after boot to avoid UI jank
    const timer = setTimeout(checkForUpdates, 5000);
    
    // Check every 12 hours
    const interval = setInterval(checkForUpdates, 12 * 60 * 60 * 1000);
    
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  return null;
}
