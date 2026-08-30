import { defineConfig } from "vite";

// WebDAV integration tests. Runs in Node against a real Caddy container
// (see ../docker-compose.yml) — start it first with `docker compose up -d`.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.integration.test.ts"],
  },
});
