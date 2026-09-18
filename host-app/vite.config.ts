/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Fixed, non-negotiable port so origin checks on both sides stay valid (decision A-2).
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setup-tests.ts'],
    // The contract package (packages/contract, consumed as @bdiadiun/scoring-contract) lives outside
    // host-app; its tests are included here explicitly so `npm run test` covers them too.
    include: ['src/**/*.{test,spec}.{ts,tsx}', '../packages/contract/src/**/*.test.ts'],
  },
});
