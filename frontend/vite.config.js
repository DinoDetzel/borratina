import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const cert = fileURLToPath(new URL('./certs/certificado.pem', import.meta.url));
const clave = fileURLToPath(new URL('./certs/clave.pem', import.meta.url));

/**
 * HTTPS solo si los certificados están puestos, y en desarrollo.
 *
 * Hace falta para probar desde el teléfono: compartir la foto del comprobante
 * usa la Web Share API, que solo existe en contexto seguro. Sobre `http://` con
 * la IP de la red, el navegador ni la expone y el botón cae en descargar el PNG.
 *
 * Los certificados son de andar por casa y no están versionados (`certs/` va en
 * el .gitignore). Se generan con:
 *
 *   openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 825 \
 *     -keyout certs/clave.pem -out certs/certificado.pem \
 *     -subj "/CN=Borratina LAN" \
 *     -addext "subjectAltName=IP:<tu-ip>,IP:127.0.0.1,DNS:localhost"
 *
 * La IP tiene que estar en el subjectAltName: sin eso los navegadores rechazan
 * el certificado aunque el nombre coincida.
 */
const https =
  existsSync(cert) && existsSync(clave)
    ? { key: readFileSync(clave), cert: readFileSync(cert) }
    : undefined;

export default defineConfig({
  plugins: [react()],
  server: {
    https,
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
