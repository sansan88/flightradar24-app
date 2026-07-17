import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Dev-Proxy zum Raspberry Pi, damit aircraft.json im Browser ohne
 * CORS-Header abrufbar ist. Anders als der statische Vite-Proxy liest er
 * das Ziel pro Request aus dem Query-Parameter `pi` (host:port), damit die
 * in der App eingegebene Adresse auch im Web-Dev wirkt; Fallback ist PI_URL.
 */
function piProxy(): Plugin {
  const fallback = process.env.PI_URL ?? 'http://192.168.1.100:8080';
  return {
    name: 'pi-proxy',
    configureServer(server) {
      server.middlewares.use('/data', (req, res) => {
        void (async () => {
          const url = new URL(req.url ?? '/', 'http://localhost');
          const pi = url.searchParams.get('pi');
          const base = pi && /^[\w.-]+:\d{1,5}$/.test(pi) ? `http://${pi}` : fallback;
          const upstream = await fetch(`${base}/data${url.pathname}`, {
            signal: AbortSignal.timeout(5000),
          });
          res.statusCode = upstream.status;
          res.setHeader(
            'content-type',
            upstream.headers.get('content-type') ?? 'application/json'
          );
          res.end(Buffer.from(await upstream.arrayBuffer()));
        })().catch((err: unknown) => {
          res.statusCode = 502;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: String(err) }));
        });
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    piProxy(),
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
    // /data/* übernimmt das piProxy-Plugin (Ziel pro Request wählbar)
    proxy: {
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
