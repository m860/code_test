import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // Monorepo: share root .env (VITE_CODE_SENTRY_*)
  envDir: resolve(__dirname, '../..'),
  server: {
    port: 5175,
    proxy: {
      '/v1': {
        target: 'http://localhost:3100',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
});
