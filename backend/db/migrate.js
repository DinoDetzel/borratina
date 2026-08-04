/**
 * Runner de migraciones mínimo.
 *
 * Aplica en orden alfabético los .sql de db/migrations/ que todavía no estén
 * registrados en la tabla `migraciones`, cada uno dentro de su propia
 * transacción. Correrlo dos veces no repite nada.
 *
 *   npm run migrate
 */
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { pool, withTransaction } from '../src/db.js';

const DIRECTORIO = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migraciones (
      nombre     TEXT PRIMARY KEY,
      aplicada_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const { rows } = await pool.query('SELECT nombre FROM migraciones');
  const aplicadas = new Set(rows.map((r) => r.nombre));

  const archivos = (await readdir(DIRECTORIO)).filter((f) => f.endsWith('.sql')).sort();

  const pendientes = archivos.filter((f) => !aplicadas.has(f));
  if (pendientes.length === 0) {
    console.log('Sin migraciones pendientes.');
    return;
  }

  for (const archivo of pendientes) {
    const sql = await readFile(join(DIRECTORIO, archivo), 'utf8');
    process.stdout.write(`Aplicando ${archivo}... `);

    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO migraciones (nombre) VALUES ($1)', [archivo]);
    });

    console.log('ok');
  }

  console.log(`\n${pendientes.length} migración/es aplicada/s.`);
}

main()
  .catch((err) => {
    console.error('\nFalló la migración:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
