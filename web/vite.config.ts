import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

export default defineConfig({
  plugins: [solidPlugin()],

  server: {
    port: 5173,
    proxy: {
      // Dev: proxy WebDAV from Vite to Caddy
      "/dav": {
        target: "http://localhost:8282",
        changeOrigin: true,
      },
    },
  },

  build: {
    target: "esnext",
    outDir: "dist",
  },
});
