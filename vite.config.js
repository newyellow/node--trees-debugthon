import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { aerialCachePlugin } from './scripts/aerial-cache.mjs';

export default defineConfig({
  plugins: [aerialCachePlugin({
    directory: fileURLToPath(new URL('./data/offline-imagery/tiles/', import.meta.url)),
    offline: process.env.IMAGERY_OFFLINE === '1',
  })],
});
