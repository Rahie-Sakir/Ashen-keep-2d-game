import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// During development the client talks to the Express API on :4000.
// Requests to /api are proxied so the browser stays same-origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_TARGET ?? "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
