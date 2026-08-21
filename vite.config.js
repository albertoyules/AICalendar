import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5180,
    // El cerebro corre aparte, en server/. Con el proxy el navegador llama a
    // /api y no hay CORS ni URLs distintas entre desarrollo y produccion.
    proxy: { '/api': 'http://localhost:8787' },
  },
});
