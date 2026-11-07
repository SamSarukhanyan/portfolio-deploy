import { readFileSync } from "node:fs";
import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// STUDIO_LAN=1: listen on the local network over HTTPS, so a phone can open it and use its camera
// (Safari only allows the camera on localhost or https). The APIs stay on 127.0.0.1 behind this proxy.
const lan = process.env.STUDIO_LAN === "1";

const ortVersion = JSON.parse(readFileSync("node_modules/onnxruntime-web/package.json", "utf8")).version;

export default defineConfig({
  plugins: [react(), ...(lan ? [basicSsl({ name: "yolo-studio" })] : [])],
  define: { __ORT_VERSION__: JSON.stringify(ortVersion) },
  optimizeDeps: { exclude: ["onnxruntime-web"] },
  server: {
    port: lan ? 5443 : 5180,
    strictPort: true,
    host: lan ? "0.0.0.0" : "localhost",
    // Cross-origin isolation lets onnxruntime-web use multi-threaded WASM.
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "credentialless",
    },
    proxy: {
      "/api": "http://127.0.0.1:4010",
      "/vision": {
        target: "http://127.0.0.1:8001",
        ws: true,
        rewrite: (p) => p.replace(/^\/vision/, ""),
      },
    },
  },
});
