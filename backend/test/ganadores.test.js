import 'dotenv/config';
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

import { condicionGanadora, esGanadora } from '../src/utils/ganadores.js';

/** Un extracto de 20 sin repetidos, para los casos base. */
const EXTRACTO = [7, 14, 23, 31, 45, 52, 60, 66, 71, 88, 2, 19, 27, 33, 40, 55, 63, 77, 84, 91];

/**
 * Arma un extracto de 20 con los números que se le pidan adelante y relleno
 * detrás. El relleno **nunca repite** lo pedido, que es justamente lo que hay que
 * poder controlar acá: si el relleno cuela otro 55 sin querer, un caso pensado
 * para "salieron tres" termina probando "salieron cuatro" y el test miente.
 */
function extractoCon(...numeros) {
  const relleno = [];
  for (let n = 10; numeros.length + relleno.length < 20; n += 1) {
    if (!numeros.includes(n)) relleno.push(n);
  }
  return [...numeros, ...relleno];
}

describe('esGanadora', () => {
  it('gana si los 4 están dentro del extracto', () => {
    assert.equal(esGanadora([7, 23, 45, 88], EXTRACTO), true);
  });

  it('pierde si falta uno solo', () => {
    // El 99 no salió: no hay premio por acertar 3 de 4.
    assert.equal(esGanadora([7, 23, 45, 99], EXTRACTO), false);
  });

  it('el orden no importa de ninguno de los dos lados', () => {
    assert.equal(esGanadora([88, 45, 23, 7], EXTRACTO), true);
    assert.equal(esGanadora([7, 23, 45, 88], [...EXTRACTO].reverse()), true);
  });

  it('con un solo 07 en el extracto, la jugada 07 07 pierde', () => {
    // Es la parte que se olvida: la contención es de multiconjunto.
    assert.equal(esGanadora([7, 7, 23, 45], EXTRACTO), false);
  });

  it('con dos 07 en el extracto, la jugada 07 07 gana', () => {
    assert.equal(esGanadora([7, 7, 23, 45], extractoCon(7, 7, 23, 45)), true);
  });

  it('cuatro veces el mismo número necesita que haya salido cuatro veces', () => {
    assert.equal(esGanadora([55, 55, 55, 55], extractoCon(55, 55, 55)), false);
    assert.equal(esGanadora([55, 55, 55, 55], extractoCon(55, 55, 55, 55)), true);
  });

  it('sin extracto no gana nadie: el sorteo todavía no se sorteó', () => {
    assert.equal(esGanadora([7, 23, 45, 88], null), false);
    assert.equal(esGanadora([7, 23, 45, 88], undefined), false);
  });

  it('el 0 juega como cualquier otro número', () => {
    // Cuidado con tratarlo como falsy en cualquier reescritura.
    const conCero = [0, ...EXTRACTO.slice(1)];
    assert.equal(esGanadora([0, 14, 23, 31], conCero), true);
    assert.equal(esGanadora([0, 14, 23, 31], EXTRACTO), false);
  });
});

/**
 * La regla vive escrita dos veces —`condicionGanadora()` en SQL y `esGanadora()`
 * en JS— y tienen que dar siempre lo mismo. Nada en el sistema avisa si se
 * separan: el listado usa la SQL y el comprobante la JS, así que una jugada
 * podría figurar ganadora en una pantalla y perdedora en el papel.
 *
 * Esto corre las dos sobre los mismos casos y compara. Necesita un Postgres de
 * verdad, porque la mitad SQL depende de `<@` y de `unnest`, que no se simulan.
 * Sin DATABASE_URL los tests se saltean en vez de fallar: el resto de la suite
 * no tiene por qué exigir una base.
 */
describe('paridad entre la regla SQL y la JS', async () => {
  const pool = process.env.DATABASE_URL
    ? new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
      })
    : null;

  const disponible = pool
    ? await pool
        .query('SELECT 1')
        .then(() => true)
        .catch(() => false)
    : false;

  after(async () => {
    if (pool) await pool.end();
  });

  /** Evalúa la condición SQL sin tocar las tablas reales: los datos van por VALUES. */
  async function ganaSegunSQL(jugada, extracto) {
    const { rows } = await pool.query(
      `SELECT ${condicionGanadora('j', 's')} AS gana
       FROM (VALUES ($1::smallint, $2::smallint, $3::smallint, $4::smallint))
              AS j(numero_1, numero_2, numero_3, numero_4),
            (VALUES ($5::smallint[])) AS s(numeros)`,
      [...jugada, extracto],
    );
    return rows[0].gana;
  }

  const casos = [
    ['los 4 adentro', [7, 23, 45, 88], EXTRACTO],
    ['falta uno', [7, 23, 45, 99], EXTRACTO],
    ['ninguno', [1, 3, 5, 9], EXTRACTO],
    ['repetido sin respaldo', [7, 7, 23, 45], EXTRACTO],
    ['repetido con respaldo', [7, 7, 23, 45], extractoCon(7, 7, 23, 45)],
    ['cuatro iguales, salieron tres', [55, 55, 55, 55], extractoCon(55, 55, 55)],
    ['cuatro iguales, salieron cuatro', [55, 55, 55, 55], extractoCon(55, 55, 55, 55)],
    ['el cero cuenta', [0, 14, 23, 31], extractoCon(0, 14, 23, 31)],
    ['el cero no salió', [0, 14, 23, 31], EXTRACTO],
    ['triple justo', [9, 9, 9, 40], extractoCon(9, 9, 9, 40)],
    ['triple de menos', [9, 9, 9, 40], extractoCon(9, 9, 40)],
  ];

  for (const [nombre, jugada, extracto] of casos) {
    it(`coinciden: ${nombre}`, { skip: disponible ? false : 'sin DATABASE_URL' }, async () => {
      const sql = await ganaSegunSQL(jugada, extracto);
      const js = esGanadora(jugada, extracto);
      assert.equal(sql, js, `SQL dijo ${sql} y JS dijo ${js} para ${JSON.stringify(jugada)}`);
    });
  }

  it(
    'coinciden en 200 combinaciones al azar',
    { skip: disponible ? false : 'sin DATABASE_URL' },
    async () => {
      // Rango chico a propósito: con 0-99 casi todo pierde y no se probaría nada.
      // Entre 0 y 9 hay aciertos y repetidos seguido, que es donde las dos
      // implementaciones se podrían separar.
      const alAzar = (max) => Math.floor(Math.random() * max);

      for (let i = 0; i < 200; i += 1) {
        const jugada = Array.from({ length: 4 }, () => alAzar(10));
        const extracto = Array.from({ length: 20 }, () => alAzar(10));

        const sql = await ganaSegunSQL(jugada, extracto);
        const js = esGanadora(jugada, extracto);

        assert.equal(
          sql,
          js,
          `se separaron con jugada ${JSON.stringify(jugada)} y extracto ${JSON.stringify(extracto)}`,
        );
      }
    },
  );
});
