/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import packageJson from './package.json' with { type: 'json' }

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  base: '/',
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __E2E_BRIDGE__: JSON.stringify(process.env.PLAYWRIGHT_E2E === '1'),
  },
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: 'prompt',
    includeAssets: ['icon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
    manifest: {
      name: 'Study Hour',
      short_name: 'StudyHour',
      description: 'Smart GCSE revision planner that prioritises what to study based on exam dates, confidence, and performance.',
      theme_color: '#3B82F6',
      background_color: '#F9FAFB',
      display: 'standalone',
      scope: '/',
      start_url: '/',
      icons: [
        {
          src: 'pwa-64x64.png',
          sizes: '64x64',
          type: 'image/png',
        },
        {
          src: 'pwa-192x192.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: 'pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png',
        },
        {
          src: 'maskable-icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    workbox: {
      cleanupOutdatedCaches: true,
      skipWaiting: true,
      clientsClaim: true,
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      globIgnores: ['**/version.json'],
      navigateFallbackDenylist: [
        /\/sitemap\.xml(\?|$)/,
        /\/robots\.txt(\?|$)/,
        /\/version\.json(\?|$)/,
      ],
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'google-fonts-cache',
            expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
      ],
    },
  }), cloudflare()],
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
})