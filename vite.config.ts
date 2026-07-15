import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'SkyPi — Live-Flugradar im Heimnetz',
        short_name: 'SkyPi',
        lang: 'de',
        description:
          'Zeigt alle vom eigenen ADS-B-Empfänger (Raspberry Pi) empfangenen Flugzeuge live auf der Karte.',
        theme_color: '#f2f2f7',
        background_color: '#f2f2f7',
        display: 'standalone',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Der App-Bundle ist >2 MB (MapLibre); Standardlimit anheben,
        // damit er im Precache landet.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Live-Daten (Pi-Aircraft-Service, MeteoSchweiz-Proxy) nie aus dem
        // Cache beantworten — die App zeigt Echtzeitdaten.
        navigateFallbackDenylist: [/^\/data\//, /^\/meteo\//],
      },
    }),
  ],
  server: {
    host: true,
    // Dev-Proxy zum Raspberry Pi, damit aircraft.json im Browser ohne
    // CORS-Header abrufbar ist (Ziel via PI_URL überschreibbar)
    proxy: {
      '/data': {
        target: process.env.PI_URL ?? 'http://192.168.1.174:8080',
        changeOrigin: true,
      },
      // Niederschlagsradar von MeteoSchweiz (sendet keine CORS-Header)
      '/meteo': {
        target: 'https://www.meteoschweiz.admin.ch',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/meteo/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
