import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) {
            return "react-vendor";
          }
          if (id.includes("node_modules/swiper/")) {
            return "swiper-vendor";
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    open: true,
    // contracts/ lives next to client/ and is shared with the Control Plane.
    fs: { allow: [".."] },
    proxy: {
      // Incident Lab Control Plane (server/src/lab); the rest of /api is the i18n API.
      "^/api/(lab|scenarios|incidents|events)": {
        target: "http://127.0.0.1:3100",
      },
      "/api": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
      },
    },
  },
});
