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
        // Se puede apuntar a otro backend con BACKEND_URL, que sirve para
        // probar la app contra una base de prueba sin tocar la de desarrollo.
        target: process.env.BACKEND_URL ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
