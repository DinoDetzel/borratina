import { app } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';

const server = app.listen(config.port, () => {
  console.log(`API de la borratina escuchando en http://localhost:${config.port}`);
});

/** Render manda SIGTERM al redeployar: cerramos prolijo para no cortar requests. */
for (const senal of ['SIGTERM', 'SIGINT']) {
  process.on(senal, () => {
    console.log(`\n${senal} recibido, cerrando...`);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  });
}
