import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ch.sansan.flightradar',
  appName: 'SkyPi',
  webDir: 'dist',
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
