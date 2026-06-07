import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const useHttps = process.env.VITE_HTTPS !== 'false';

export default defineConfig({
  // Relative paths so Capacitor's WebView can load bundled assets.
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [react(), ...(useHttps ? [basicSsl()] : [])],
  server: {
    host: true,
  },
});
