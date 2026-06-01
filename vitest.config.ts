import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  test: {
    // pool: "vmThreads" — bypass macOS fork/threads worker IPC timeout
    // saat path mengandung space ("Claude Code/"). In Vitest 4, vmThreads
    // pool runs tests in worker_threads with VM isolation.
    pool: "vmThreads",
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx,js,jsx}"],
    exclude: ["node_modules", "dist"],
  },
})
