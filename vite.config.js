import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// base './' -> rutas relativas: funciona en GitHub Pages, Netlify o cualquier subcarpeta.
export default defineConfig({
  base: './',
  plugins: [basicSsl()],
  // allowedHosts: permite abrirla por un túnel público (cloudflared).
  server: { host: true, allowedHosts: ['.trycloudflare.com'] },
  preview: { host: true },
  build: { target: 'es2020', chunkSizeWarningLimit: 1500 },
});
