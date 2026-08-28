import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';

/**
 * Tests de las rutas: las reglas de permisos y los candados de estado.
 *
 * Son las reglas que el `.rules` argumenta con más cuidado —quién ve qué, qué se
 * puede tocar después del sorteo— y hasta ahora eran las únicas que nada
 * verificaba. Un `CHECK` de la base no las cubre: viven en el `WHERE` de una
 * query y en un `if` de un middleware, y se rompen sin que falle nada.
 *
 * ## Cómo correrlos
 *
 *     TEST_DATABASE_URL=postgresql://...  npm test
 *
 * **Piden una base descartable, y por eso van detrás de su propia variable.**
 * Estos tests escriben: crean cuentas, abren un sorteo y lo finalizan. Reusar
 * `DATABASE_URL` habría sido un tiro al pie el día que alguien la tenga apuntando
 * a Supabase. Sin `TEST_DATABASE_URL` se saltean, igual que los de paridad.
 *
 * La base tiene que tener las migraciones corridas y **ningún sorteo abierto**:
 * el índice único parcial no deja abrir un segundo.
 */

const urlDePrueba = process.env.TEST_DATABASE_URL;

// El motivo de saltear se arma antes de importar nada: `config.js` corta el
// proceso si le falta una variable, así que hay que dejarlas puestas primero.
if (urlDePrueba) {
  process.env.DATABASE_URL = urlDePrueba;
  process.env.JWT_SECRET ??= 'secreto-solo-para-los-tests';
  process.env.DATABASE_SSL ??= 'false';
}

const { app } = urlDePrueba ? await import('../src/app.js') : { app: null };
const { pool } = urlDePrueba ? await import('../src/db.js') : { pool: null };

// Se sondea la conexión antes de empezar, igual que los tests de paridad: con la
// URL mal escrita, arrancar igual llenaba la salida de ECONNREFUSED repetidos y
// el motivo real quedaba enterrado.
const alcanzable = pool
  ? await pool
      .query('SELECT 1')
      .then(() => true)
      .catch(() => false)
  : false;

const activo = Boolean(urlDePrueba) && alcanzable;

const motivo = urlDePrueba ? 'TEST_DATABASE_URL no responde' : 'sin TEST_DATABASE_URL';

/**
 * Saltear es lo correcto local —nadie quiere levantar un Postgres para tocar un
 * `.css`— pero en CI es un agujero: un `describe` salteado registra **cero**
 * tests, no tests salteados, así que la suite adelgaza sin que ningún contador
 * lo note y el build queda verde con treinta y pico de asserts mudos.
 *
 * En CI, entonces, esto revienta en vez de callarse.
 */
if (process.env.CI && !activo) {
  throw new Error(
    `Los tests de rutas no pueden saltearse en CI (${motivo}). ` +
      'El workflow tiene que levantar un Postgres y pasar TEST_DATABASE_URL.',
  );
}

const saltear = activo ? false : motivo;

/** Un período lejano, para no pisarse con datos reales si la base no está vacía. */
const PERIODO = '2099-12';

/** Marca de esta corrida, para que dos seguidas no choquen contra el UNIQUE. */
const marca = `t${Date.now().toString(36).slice(-6)}`;

let servidor;
let base;
const sesion = {};
const jugadaDe = {};
let sorteoId;

/** Un request a la API. Devuelve el status y el cuerpo ya parseado. */
async function pedir(metodo, ruta, { token, body } = {}) {
  const respuesta = await fetch(`${base}${ruta}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: respuesta.status, cuerpo: await respuesta.json().catch(() => null) };
}

/** Borra lo que crea esta corrida, en orden de claves foráneas. */
async function limpiar() {
  await pool.query(
    `DELETE FROM jugadas_eventos WHERE jugada_id IN
       (SELECT id FROM jugadas WHERE sorteo_id IN (SELECT id FROM sorteos WHERE periodo = $1))`,
    [PERIODO],
  );
  await pool.query(
    'DELETE FROM jugadas WHERE sorteo_id IN (SELECT id FROM sorteos WHERE periodo = $1)',
    [PERIODO],
  );
  await pool.query('DELETE FROM sorteos WHERE periodo = $1', [PERIODO]);
  await pool.query('DELETE FROM usuarios WHERE usuario LIKE $1', [`${marca}%`]);
}

before(async () => {
  if (!activo) return;

  await limpiar();

  const hash = await bcrypt.hash('clave-de-prueba', 4); // costo bajo: son de mentira
  for (const [quien, rol] of [['admin', 'admin'], ['a', 'vendedor'], ['b', 'vendedor']]) {
    const { rows } = await pool.query(
      `INSERT INTO usuarios (nombre, usuario, password_hash, rol)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [`Prueba ${quien}`, `${marca}${quien}`, hash, rol],
    );
    sesion[quien] = { id: rows[0].id, usuario: `${marca}${quien}` };
  }

  servidor = app.listen(0);
  await new Promise((listo) => servidor.once('listening', listo));
  base = `http://127.0.0.1:${servidor.address().port}/api`;

  for (const quien of ['admin', 'a', 'b']) {
    const { cuerpo } = await pedir('POST', '/auth/login', {
      body: { usuario: sesion[quien].usuario, password: 'clave-de-prueba' },
    });
    sesion[quien].token = cuerpo.token;
  }

  // Un sorteo abierto con la ventana vigente, y una jugada de cada vendedor.
  const { cuerpo: creado } = await pedir('POST', '/sorteos', {
    token: sesion.admin.token,
    body: {
      periodo: PERIODO,
      precio_jugada: 2000,
      pozo: 1_500_000,
      inicia_at: new Date(Date.now() - 3_600_000).toISOString(),
      finaliza_at: new Date(Date.now() + 3_600_000).toISOString(),
    },
  });
  sorteoId = creado.sorteo.id;

  for (const quien of ['a', 'b']) {
    const { cuerpo } = await pedir('POST', '/jugadas', {
      token: sesion[quien].token,
      body: { numeros: [7, 23, 45, 88], comprador_nombre: `Comprador de ${quien}` },
    });
    jugadaDe[quien] = cuerpo.jugada;
  }
});

after(async () => {
  if (pool && !activo) return pool.end();
  if (!activo) return;
  await limpiar();
  await new Promise((listo) => servidor.close(listo));
  await pool.end();
});

describe('sin token no se entra a ningún lado', { skip: saltear }, () => {
  for (const ruta of ['/jugadas', '/sorteos/actual', '/dashboard/resumen', '/auth/me']) {
    it(`${ruta} responde 401`, async () => {
      const { status } = await pedir('GET', ruta);
      assert.equal(status, 401);
    });
  }

  it('con un token inventado también', async () => {
    const { status } = await pedir('GET', '/jugadas', { token: 'no.es.un.token' });
    assert.equal(status, 401);
  });
});

describe('un vendedor ve solo lo suyo', { skip: saltear }, () => {
  it('el listado no trae las jugadas de otro', async () => {
    const { cuerpo } = await pedir('GET', `/jugadas?sorteo_id=${sorteoId}`, {
      token: sesion.a.token,
    });
    const vendedores = new Set(cuerpo.jugadas.map((j) => j.vendedor_id));
    assert.deepEqual([...vendedores], [sesion.a.id]);
  });

  it('pedir ?vendedor_id de otro no sirve de nada', async () => {
    // La regla que el README promete: el filtro se impone en el servidor.
    const { cuerpo } = await pedir(
      'GET',
      `/jugadas?sorteo_id=${sorteoId}&vendedor_id=${sesion.b.id}`,
      { token: sesion.a.token },
    );
    assert.ok(cuerpo.jugadas.length > 0, 'debería seguir viendo las propias');
    for (const j of cuerpo.jugadas) assert.equal(j.vendedor_id, sesion.a.id);
  });

  it('el admin sí puede filtrar por vendedor', async () => {
    const { cuerpo } = await pedir(
      'GET',
      `/jugadas?sorteo_id=${sorteoId}&vendedor_id=${sesion.b.id}`,
      { token: sesion.admin.token },
    );
    assert.ok(cuerpo.jugadas.length > 0);
    for (const j of cuerpo.jugadas) assert.equal(j.vendedor_id, sesion.b.id);
  });

  it('una jugada ajena da 404 y no 403', async () => {
    // 404 a propósito: un 403 le confirmaría al vendedor que ese id existe.
    const { status } = await pedir('GET', `/jugadas/${jugadaDe.b.id}`, { token: sesion.a.token });
    assert.equal(status, 404);
  });

  it('un comprobante ajeno tampoco aparece', async () => {
    const { status } = await pedir('GET', `/jugadas/comprobante/${jugadaDe.b.codigo}`, {
      token: sesion.a.token,
    });
    assert.equal(status, 404);
  });

  it('el suyo sí', async () => {
    const { status, cuerpo } = await pedir('GET', `/jugadas/comprobante/${jugadaDe.a.codigo}`, {
      token: sesion.a.token,
    });
    assert.equal(status, 200);
    assert.equal(cuerpo.comprobante.codigo, jugadaDe.a.codigo);
  });
});

describe('los totales del sorteo son del admin', { skip: saltear }, () => {
  it('al vendedor no se le dice cuánto vendieron los demás', async () => {
    const { cuerpo } = await pedir('GET', '/sorteos/actual', { token: sesion.a.token });
    assert.equal(cuerpo.sorteo.jugadas_cargadas, undefined);
    assert.equal(cuerpo.sorteo.recaudacion, undefined);
    // Lo suyo sí, que es lo que su pantalla muestra.
    assert.equal(cuerpo.sorteo.mis_jugadas, 1);
    // Y el pozo, que es el premio anunciado y lo ve todo el mundo.
    assert.equal(cuerpo.sorteo.pozo, 1_500_000);
  });

  it('al admin sí', async () => {
    const { cuerpo } = await pedir('GET', '/sorteos/actual', { token: sesion.admin.token });
    assert.equal(cuerpo.sorteo.jugadas_cargadas, 2);
    assert.equal(cuerpo.sorteo.recaudacion, 4000);
  });
});

describe('lo que solo puede el admin', { skip: saltear }, () => {
  // Las rutas se arman dentro del `it` y no acá: los títulos de un `describe` se
  // evalúan al construirlo, antes de que el `before` haya creado nada.
  const prohibidas = [
    ['corregir una jugada', 'PATCH', () => `/jugadas/${jugadaDe.a.id}`, { comprador_nombre: 'Otro' }],
    ['anular una jugada', 'POST', () => `/jugadas/${jugadaDe.a.id}/anular`, undefined],
    ['restaurar una jugada', 'POST', () => `/jugadas/${jugadaDe.a.id}/restaurar`, undefined],
    ['abrir un sorteo', 'POST', () => '/sorteos', { periodo: '2099-11', precio_jugada: 1, pozo: 1 }],
    ['cerrar la carga', 'PATCH', () => `/sorteos/${sorteoId}/cerrar`, undefined],
    ['cambiar el pozo', 'PATCH', () => `/sorteos/${sorteoId}/pozo`, { pozo: 1 }],
    ['cargar el extracto', 'POST', () => `/sorteos/${sorteoId}/resultado`, { numeros: Array(20).fill(7) }],
    ['crear cuentas', 'POST', () => '/auth/usuarios', { nombre: 'X', usuario: 'xxxx', password: '12345678' }],
  ];

  for (const [que, metodo, ruta, body] of prohibidas) {
    it(`un vendedor no puede ${que}`, async () => {
      // Ni siquiera sobre su propia jugada: corregir y anular son del admin.
      const { status } = await pedir(metodo, ruta(), { token: sesion.a.token, body });
      assert.equal(status, 403);
    });
  }

  it('el dashboard entero es del admin', async () => {
    for (const ruta of ['/dashboard/resumen', '/dashboard/por-vendedor', '/dashboard/ventas']) {
      const { status } = await pedir('GET', ruta, { token: sesion.a.token });
      assert.equal(status, 403, `${ruta} tendría que dar 403`);
    }
  });
});

describe('un solo sorteo abierto a la vez', { skip: saltear }, () => {
  it('abrir un segundo da 409 con un mensaje que se entiende', async () => {
    const { status, cuerpo } = await pedir('POST', '/sorteos', {
      token: sesion.admin.token,
      body: {
        periodo: '2099-11',
        precio_jugada: 2000,
        pozo: 1000,
        inicia_at: new Date().toISOString(),
        finaliza_at: new Date(Date.now() + 3_600_000).toISOString(),
      },
    });
    assert.equal(status, 409);
    assert.match(cuerpo.error, /sorteo con la carga abierta/i);
  });
});

describe('la ventana de carga la hace cumplir la base', { skip: saltear }, () => {
  it('fuera de la ventana no se carga, aunque el sorteo siga abierto', async () => {
    // Se corre la ventana al pasado y se intenta cargar.
    await pedir('PATCH', `/sorteos/${sorteoId}/ventana`, {
      token: sesion.admin.token,
      body: {
        inicia_at: new Date(Date.now() - 7_200_000).toISOString(),
        finaliza_at: new Date(Date.now() - 3_600_000).toISOString(),
      },
    });

    const { status, cuerpo } = await pedir('POST', '/jugadas', {
      token: sesion.a.token,
      body: { numeros: [1, 2, 3, 4], comprador_nombre: 'Tarde' },
    });
    assert.equal(status, 409);
    assert.match(cuerpo.error, /cerró/i);

    // Se deja vigente de nuevo para lo que sigue.
    await pedir('PATCH', `/sorteos/${sorteoId}/ventana`, {
      token: sesion.admin.token,
      body: {
        inicia_at: new Date(Date.now() - 3_600_000).toISOString(),
        finaliza_at: new Date(Date.now() + 3_600_000).toISOString(),
      },
    });
  });
});

/**
 * Van al final porque finalizan el sorteo, y eso no tiene vuelta atrás: las
 * transiciones son solo hacia adelante.
 */
describe('con el extracto cargado ya no se mueve quién cobra', { skip: saltear }, () => {
  before(async () => {
    if (!activo) return;
    await pedir('PATCH', `/sorteos/${sorteoId}/cerrar`, { token: sesion.admin.token });
    // Un extracto que contiene los números de las dos jugadas: las dos ganan.
    await pedir('POST', `/sorteos/${sorteoId}/resultado`, {
      token: sesion.admin.token,
      body: { numeros: [7, 23, 45, 88, ...Array.from({ length: 16 }, (_, i) => i + 30)] },
    });
  });

  it('las dos jugadas figuran ganadoras', async () => {
    const { cuerpo } = await pedir('GET', `/sorteos/${sorteoId}/ganadores`, {
      token: sesion.admin.token,
    });
    assert.equal(cuerpo.ganadores.length, 2);
    assert.equal(cuerpo.premio_por_ganador, 750_000);
  });

  it('el comprobante dice que ganó y cuánto', async () => {
    const { cuerpo } = await pedir('GET', `/jugadas/comprobante/${jugadaDe.a.codigo}`, {
      token: sesion.a.token,
    });
    assert.equal(cuerpo.gano, true);
    assert.equal(cuerpo.cantidad_ganadores, 2);
    assert.equal(cuerpo.premio, 750_000);
  });

  it('cambiar los números da 409', async () => {
    const { status, cuerpo } = await pedir('PATCH', `/jugadas/${jugadaDe.a.id}`, {
      token: sesion.admin.token,
      body: { numeros: [1, 2, 3, 4] },
    });
    assert.equal(status, 409);
    assert.match(cuerpo.error, /no se pueden cambiar después del sorteo/i);
  });

  it('corregir el nombre del comprador sigue andando', async () => {
    // No cambia quién gana, y un apellido mal escrito hay que poder arreglarlo.
    const { status, cuerpo } = await pedir('PATCH', `/jugadas/${jugadaDe.a.id}`, {
      token: sesion.admin.token,
      body: { comprador_nombre: 'Nombre Corregido' },
    });
    assert.equal(status, 200);
    assert.equal(cuerpo.jugada.comprador_nombre, 'Nombre Corregido');
  });

  it('anular sigue permitido: quitar un cobrador no es elegirlo', async () => {
    const { status } = await pedir('POST', `/jugadas/${jugadaDe.b.id}/anular`, {
      token: sesion.admin.token,
    });
    assert.equal(status, 200);
  });

  it('y el reparto se recalcula sobre los que quedan', async () => {
    const { cuerpo } = await pedir('GET', `/sorteos/${sorteoId}/ganadores`, {
      token: sesion.admin.token,
    });
    assert.equal(cuerpo.ganadores.length, 1);
    assert.equal(cuerpo.premio_por_ganador, 1_500_000);
  });

  it('restaurar NO: eso sí sería elegir quién cobra', async () => {
    const { status, cuerpo } = await pedir('POST', `/jugadas/${jugadaDe.b.id}/restaurar`, {
      token: sesion.admin.token,
    });
    assert.equal(status, 409);
    assert.match(cuerpo.error, /no se puede restaurar después del sorteo/i);
  });

  it('la anulación quedó registrada con nombre y apellido', async () => {
    const { cuerpo } = await pedir('GET', `/jugadas/${jugadaDe.b.id}`, {
      token: sesion.admin.token,
    });
    assert.equal(cuerpo.jugada.anulada, true);
    assert.deepEqual(
      cuerpo.historial.map((e) => e.tipo),
      ['anulada'],
    );
    assert.equal(cuerpo.historial[0].usuario, 'Prueba admin');
  });

  it('una cuenta que dejó rastro no se puede borrar', async () => {
    const { status, cuerpo } = await pedir('DELETE', `/auth/usuarios/${sesion.b.id}`, {
      token: sesion.admin.token,
    });
    assert.equal(status, 409);
    assert.match(cuerpo.error, /historial/i);
  });
});
