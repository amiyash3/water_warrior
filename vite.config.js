import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const useHttps = process.env.VITE_HTTPS !== 'false';

/** Capacitor iOS WebView fails to load module scripts with crossorigin. */
function capacitorBuildPlugin() {
  return {
    name: 'capacitor-build',
    transformIndexHtml(html) {
      return html.replace(/\s+crossorigin/g, '');
    },
  };
}

export default defineConfig({
  // Relative paths so Capacitor's WebView can load bundled assets.
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    modulePreload: false,
  },
  plugins: [
    react(),
    capacitorBuildPlugin(),
    ...(useHttps ? [basicSsl()] : []),
  ],
  server: {
    host: true,
  },
});
