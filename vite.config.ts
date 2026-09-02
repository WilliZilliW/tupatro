import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/* Relative asset URLs, so the same build works at a domain root and under a
   GitHub Pages project path without a rebuild. */
export default defineConfig({
  base: "./",
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
