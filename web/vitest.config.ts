import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

// Component-level unit tests. Runs in jsdom with no network access;
// tests mock services/webdav.ts (the app's only I/O boundary).
export default defineConfig({
  plugins: [solidPlugin({ hot: false })],
  resolve: {
    conditions: ["development", "browser"],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["src/**/*.integration.test.ts"],
  },
});
