import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    // Dev-Proxy zum Raspberry Pi, damit aircraft.json im Browser ohne
    // CORS-Header abrufbar ist (Ziel via PI_URL überschreibbar)
    proxy: {
      '/data': {
        target: process.env.PI_URL ?? 'http://192.168.1.174:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
