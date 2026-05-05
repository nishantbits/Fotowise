import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Exclude huge map files from precache
        globIgnores: ['**/node_modules/**/*', '**/*.map'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB limit
        runtimeCaching: [
          // Cache Thumbnails (Cache First, up to 30 days)
          {
            urlPattern: /\/api\/media\/[^/]+\/thumb\//i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fotowise-thumbnails',
              expiration: {
                maxEntries: 1000,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 Days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Cache Original Media (Stale While Revalidate, up to 7 days)
          {
            urlPattern: /\/api\/media\/[^/]+\/original/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'fotowise-originals',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 Days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Cache API Responses (Stale While Revalidate)
          {
            urlPattern: /\/api\/(media|search|stats)/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'fotowise-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 1 Day
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Background Sync for Uploads
          {
            urlPattern: /\/api\/media\/upload/i,
            handler: 'NetworkOnly',
            method: 'POST',
            options: {
              backgroundSync: {
                name: 'fotowise-upload-queue',
                options: {
                  maxRetentionTime: 24 * 60, // Retry for max 24 Hours
                },
              },
            },
          },
        ],
      },
      manifest: {
        name: 'Fotowise',
        short_name: 'Fotowise',
        description: 'Local-first cinematic photo library',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/icons/favicon.png',
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'apple touch icon',
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'router-vendor': ['react-router-dom'],
          'query-vendor': ['@tanstack/react-query'],
          'motion-vendor': ['framer-motion'],
          'utils-vendor': ['date-fns', 'axios', 'zustand', 'clsx', 'tailwind-merge'],
        },
      },
    },
  },
});
