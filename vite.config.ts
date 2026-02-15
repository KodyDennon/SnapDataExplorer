import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;
const isMock = process.env.VITE_MOCK === "true";

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: isMock ? {
      "@tauri-apps/api/core": path.resolve(__dirname, "./src/mock/core/index.ts"),
      "@tauri-apps/api/event": path.resolve(__dirname, "./src/mock/event/index.ts"),
      "@tauri-apps/api/app": path.resolve(__dirname, "./src/mock/app/index.ts"),
      "@tauri-apps/plugin-os": path.resolve(__dirname, "./src/mock/plugins/os.ts"),
      "@tauri-apps/plugin-updater": path.resolve(__dirname, "./src/mock/plugins/updater.ts"),
      "@tauri-apps/plugin-process": path.resolve(__dirname, "./src/mock/plugins/process.ts"),
      "@tauri-apps/plugin-dialog": path.resolve(__dirname, "./src/mock/plugins/dialog.ts"),
    } : {},
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
