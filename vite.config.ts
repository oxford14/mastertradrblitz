import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import path from 'node:path';
import manifest from './manifest.json';

export default defineConfig({
  base: '',
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: {
      '@mtb/shared': path.resolve(__dirname, 'packages/shared/src/index.ts'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        options: 'src/options/index.html',
      },
    },
  },
});
