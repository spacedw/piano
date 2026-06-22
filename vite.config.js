import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import packageJson from './package.json' with { type: 'json' };
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'PianoApp',
        short_name: 'Piano',
        theme_color: '#1a1a2e',
        background_color: '#0A0A0B',
        display: 'standalone',
        start_url: '/',
        orientation: 'portrait',
        description: 'Aprende piano con notas cayendo y teclado MIDI',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Reproducir',
            short_name: 'Player',
            description: 'Abre el reproductor principal',
            url: '/',
            icons: [{ src: '/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Biblioteca',
            short_name: 'Library',
            description: 'Tu colección de canciones',
            url: '/library',
            icons: [{ src: '/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Progreso',
            short_name: 'Progress',
            description: 'Tu historial de práctica',
            url: '/progress',
            icons: [{ src: '/icon-192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB — audio JS bundles
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.(?:js|css|html|ico|png|svg|woff|woff2)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            urlPattern: /\/$|\/library|\/progress/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 3020,
    allowedHosts: ['pianoapp.uiai.dev'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    extensions: ['.jsx', '.js', '.tsx', '.ts', '.json'],
  },
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
});
