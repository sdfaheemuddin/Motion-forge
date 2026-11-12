import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  build: { outDir: "../app/motion_forge/web/dist", emptyOutDir: true },
  server: {
    port: 5173,
    proxy: {
      "/builder": "http://127.0.0.1:8765",
      "/renders": "http://127.0.0.1:8765",
      "/jobs": "http://127.0.0.1:8765",
      "/health": "http://127.0.0.1:8765",
    },
  },
});
