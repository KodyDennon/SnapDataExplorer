import { useEffect, useRef } from "react";
import { check } from "@tauri-apps/plugin-updater";

interface UpdaterProps {
  addToast: (type: "info" | "success" | "warning" | "error", message: string) => void;
}

export function Updater({ addToast }: UpdaterProps) {
  const isChecking = useRef(false);

  useEffect(() => {
    async function checkForUpdates() {
      if (isChecking.current) return;
      isChecking.current = true;

      try {
        const update = await check();
        if (update) {
          console.log(`Update found: v${update.version}`);
          addToast("info", `A new update (v${update.version}) is available. Click 'About' in the sidebar to install.`);
          
          // We could automatically open the about modal, but a toast is less intrusive.
          // However, for a "great" experience, maybe we should offer a way to open it directly?
          // Since our toast system is simple, we'll just stick to the sidebar prompt.
        }
      } catch (e) {
        console.error("Background update check failed:", e);
      } finally {
        isChecking.current = false;
      }
    }

    // Background check 10 seconds after launch
    const timer = setTimeout(checkForUpdates, 10000);
    
    // Periodically check every 8 hours
    const interval = setInterval(checkForUpdates, 8 * 60 * 60 * 1000);
    
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [addToast]);

  return null;
}