import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.waterwarrior.app',
  appName: 'Water Warrior',
  webDir: 'dist',
  server: {
    // Uncomment to live-reload from your dev machine (same Wi‑Fi):
    // url: 'https://YOUR_LAN_IP:5173',
    // cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 500,
      showSpinner: false,
    },
  },
  ios: {
    // Let CSS handle safe areas (viewport-fit=cover). Automatic inset
    // double-pads and exposes the WebView's black bounce regions.
    contentInset: 'never',
  },
  backgroundColor: '#ffffff',
};

export default config;
