import { defineConfig } from "vite";
export default defineConfig({
  base: "/ai-3d-posture-coach/",
  build: { chunkSizeWarningLimit: 800 },
  server: { port: 5174 },
  preview: { port: 4174 },
});
