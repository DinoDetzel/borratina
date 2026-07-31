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

/** Lo que sale una jugada. El admin lo define al abrir cada sorteo. */
const PRECIO_JUGADA = 2000;

/** El premio anunciado. Es fijo: no depende de cuántas jugadas se vendan. */
const POZO = 1_500_000;

const periodoActual = () => new Date().toISOString().slice(0, 7); // 'AAAA-MM'

/**
 * La ventana de carga del sorteo de prueba: desde hoy hasta que termine el mes.
 * Fuera de esa ventana el backend rechaza las jugadas, así que el sorteo del seed
 * tiene que nacer con una vigente o no se puede cargar nada.
 */
function ventanaDelMes() {
  const hoy = new Date();
  const finDeMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59);
  return { inicia: hoy, finaliza: finDeMes };
}

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

    const { inicia, finaliza } = ventanaDelMes();
    await client.query(
      `INSERT INTO sorteos (periodo, precio_jugada, pozo, inicia_at, finaliza_at, estado)
       VALUES ($1, $2, $3, $4, $5, 'abierto')
       ON CONFLICT (periodo) DO NOTHING`,
      [periodoActual(), PRECIO_JUGADA, POZO, inicia, finaliza],
    );
  });

  console.log('Seed aplicado. Usuarios de prueba:\n');
  for (const u of USUARIOS) {
    console.log(`  ${u.rol.padEnd(8)} ${u.usuario.padEnd(10)} /  ${u.password}`);
  }
  console.log(
    `\nSorteo abierto del período ${periodoActual()}: ` +
      `pozo de $${POZO.toLocaleString('es-AR')}, a $${PRECIO_JUGADA} la jugada.`,
  );
}

main()
  .catch((err) => {
    console.error('Falló el seed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
