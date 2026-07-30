import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // En desarrollo el front pega a /api y Vite lo redirige al backend, así no
    // hace falta CORS ni hardcodear el host. En producción (Vercel) se usa
    // VITE_API_URL apuntando al servicio de Render.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
