import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

const POCKETBASE = 'http://127.0.0.1:8090'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Tally',
        short_name: 'Tally',
        description: 'Simple household budgets',
        display: 'standalone',
        start_url: '/',
        theme_color: '#F7931E',
        background_color: '#F2F1ED',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        // These are PocketBase's, not the single-page app's.
        navigateFallbackDenylist: [/^\/api\//, /^\/_\//],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': POCKETBASE,
      '/_': POCKETBASE,
    },
  },
})
