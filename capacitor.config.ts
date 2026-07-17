import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CapacitorConfig } from '@capacitor/cli';

const { version } = JSON.parse(
  readFileSync(join(__dirname, 'package.json'), 'utf-8')
) as { version: string };

const config: CapacitorConfig = {
  appId: 'ch.sansan.flightradar',
  appName: 'SkyPi',
  webDir: 'dist',
  // OSM Tile Usage Policy: Apps müssen sich mit eindeutigem User-Agent
  // ausweisen (statt generischem WebView-UA), sonst droht Blockierung.
  appendUserAgent: `SkyPi/${version} (+https://github.com/sansan88/flightradar24-app)`,
  // Kein contentInset: Die WebView läuft edge-to-edge, Ionic übernimmt die
  // Safe-Areas selbst (env(safe-area-inset-*), viewport-fit=cover).
  // 'always' schob Header/Tab-Bar doppelt von den Rändern weg.
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    SplashScreen: {
      // Splash bleibt stehen, bis die App bereit ist (SplashScreen.hide()
      // in App.tsx), statt nach fixer Zeit auszublenden.
      launchAutoHide: false,
    },
  },
};

export default config;
