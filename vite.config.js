import { defineConfig } from 'vite';
import { privatePlanningBuildPlugin } from './scripts/private-planning-build.mjs';
import { fileURLToPath } from 'node:url';
import { faviconPlugin } from './scripts/favicon.mjs';
import { googleAnalyticsPlugin } from './scripts/google-analytics.mjs';
import { aerialCachePlugin } from './scripts/aerial-cache.mjs';

export default defineConfig({
  server: { port: 6996, strictPort: true },
  preview: { port: 6996, strictPort: true },
  build: {
    rollupOptions: {
      input: {
        home: fileURLToPath(new URL('./index.html', import.meta.url)),
        stories: fileURLToPath(new URL('./stories/index.html', import.meta.url)),
        storyResearch: fileURLToPath(new URL('./stories/research/index.html', import.meta.url)),
        explorer: fileURLToPath(new URL('./explorer/index.html', import.meta.url)),
        workspace02: fileURLToPath(new URL('./workspaces/02/index.html', import.meta.url)),
        workspace03: fileURLToPath(new URL('./workspaces/03/index.html', import.meta.url)),
      },
    },
  },
  plugins: [privatePlanningBuildPlugin(), faviconPlugin(), googleAnalyticsPlugin(), aerialCachePlugin({
    directory: fileURLToPath(new URL('./data/offline-imagery/tiles/', import.meta.url)),
    offline: process.env.IMAGERY_OFFLINE === '1',
  })],
});
