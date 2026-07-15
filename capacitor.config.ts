import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ch.sansan.flightradar',
  appName: 'SkyPi',
  webDir: 'dist',
  ios: {
    contentInset: 'always',
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
