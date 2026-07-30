/**
 * Datos de prueba para desarrollo: un admin, dos vendedores y un sorteo abierto
 * del mes en curso. Es idempotente (ON CONFLICT DO NOTHING), así que se puede
 * correr varias veces.
 *
 *   npm run seed
 *
 * OJO: las contraseñas de acá son de juguete. No correr esto en producción.
 */
import bcrypt from 'bcryptjs';

import { pool, withTransaction } from '../src/db.js';

const USUARIOS = [
  { nombre: 'Admin', usuario: 'admin', password: 'admin1234', rol: 'admin' },
  { nombre: 'Vendedor Uno', usuario: 'vendedor1', password: 'vende1234', rol: 'vendedor' },
  { nombre: 'Vendedor Dos', usuario: 'vendedor2', password: 'vende1234', rol: 'vendedor' },
];

const periodoActual = () => new Date().toISOString().slice(0, 7); // 'AAAA-MM'

async function main() {
  await withTransaction(async (client) => {
    for (const u of USUARIOS) {
      const hash = await bcrypt.hash(u.password, 10);
      await client.query(
        `INSERT INTO usuarios (nombre, usuario, password_hash, rol)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (usuario) DO NOTHING`,
        [u.nombre, u.usuario, hash, u.rol],
      );
    }

    await client.query(
      `INSERT INTO sorteos (periodo, precio_jugada, estado)
       VALUES ($1, $2, 'abierto')
       ON CONFLICT (periodo) DO NOTHING`,
      [periodoActual(), 500],
    );
  });

  console.log('Seed aplicado. Usuarios de prueba:\n');
  for (const u of USUARIOS) {
    console.log(`  ${u.rol.padEnd(8)} ${u.usuario.padEnd(10)} /  ${u.password}`);
  }
  console.log(`\nSorteo abierto del período ${periodoActual()} a $500 la jugada.`);
}

main()
  .catch((err) => {
    console.error('Falló el seed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
