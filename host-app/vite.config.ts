/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Mirrors the `@app/*` paths entry in tsconfig.app.json; both the dev server, the build and the
  // Vitest run resolve through this one alias.
  resolve: {
    alias: {
      '@app': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Fixed, non-negotiable port so origin checks on both sides stay valid (decision A-2).
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setup-tests.ts'],
    // The published packages live outside host-app, so their tests are collected here as well.
    // The pattern covers every package rather than naming them: a package left off a list is
    // merged with tests nobody runs, and three packages in a row were.
    include: ['src/**/*.{test,spec}.{ts,tsx}', '../packages/*/src/**/*.test.{ts,tsx}'],
  },
});
