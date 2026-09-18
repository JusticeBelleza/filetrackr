// vite.config.ts
import { defineConfig } from 'vitest/config'; 
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import legacy from '@vitejs/plugin-legacy';
import packageJson from './package.json' with { type: 'json' };

export default defineConfig({
  // Expose the version number from package.json to your React app
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  plugins: [
    react(),
    tailwindcss(),
    
    // --- Added: The Universal Compatibility Layer ---
    legacy({
      targets: [
        'defaults',
        'not IE 11',
        'ios >= 11',
        'android >= 5',
        'samsung >= 9' // Explicitly fixes Samsung Internet!
      ],
      // Polyfills modern async/await features for older engines
      additionalLegacyPolyfills: ['regenerator-runtime/runtime']
    }),

    VitePWA({
      registerType: 'prompt', // Changed from 'autoUpdate' to 'prompt'
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false // Changed to false so updates wait for user confirmation
      },
      // Added pwa-180x180.png for iOS
      includeAssets: ['favicon.ico', 'pwa-180x180.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'FileTrackr',
        short_name: 'FileTrackr',
        description: 'Document Routing System for Abra PHO',
        theme_color: '#0B1120',
        background_color: '#ffffff',
        display: 'standalone', 
        icons: [
          {
            src: '/pwa-180x180.png', // Added specifically for iOS
            sizes: '180x180',
            type: 'image/png'
          },
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: ['**/e2e/**', '**/node_modules/**'],
    env: {
      VITE_SUPABASE_URL: 'https://test-dummy.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-dummy-anon-key',
      VITE_SUPABASE_SERVICE_ROLE_KEY: 'test-dummy-service-key',
      VITE_TURNSTILE_SITE_KEY: '1x00000000000000000000AA'
    }
  },
});