import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

/**
 * NUMERIC de Postgres llega como string para no perder precisión.
 * Los montos de este sistema (pozo, precio de jugada) entran holgados en un
 * double, así que los convertimos a número para no arrastrar strings a la API.
 */
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (valor) => parseFloat(valor));
// int8 (COUNT) llega como string por el mismo motivo.
pg.types.setTypeParser(pg.types.builtins.INT8, (valor) => parseInt(valor, 10));

export const pool = new Pool({
  connectionString: config.db.connectionString,
  ssl: config.db.ssl,
  max: 10,
  idleTimeoutMillis: 30_000,

  /**
   * Las conexiones hablan en la zona del club.
   *
   * Postgres puede estar en UTC —el nuestro lo está— y ahí todo lo que pase un
   * `timestamptz` a fecha se corre tres horas: una jugada cargada a las 21:30 de
   * un martes cae en el miércoles. Eso salía impreso en el código del
   * comprobante y también movía de día las ventas del gráfico.
   *
   * No afecta lo que se guarda: las fechas entran en ISO con Z, que no depende
   * de ninguna zona. Solo cambia cómo se leen de vuelta.
   */
  options: `-c timezone=${config.zonaHoraria}`,
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de Postgres:', err);
});

/** Atajo para queries sueltas. Siempre parametrizadas: query(sql, [a, b]). */
export const query = (texto, params) => pool.query(texto, params);

/**
 * Corre `fn` dentro de una transacción, con COMMIT o ROLLBACK automático.
 * Se usa donde hay que leer y escribir de forma consistente (finalizar un
 * sorteo, por ejemplo).
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
