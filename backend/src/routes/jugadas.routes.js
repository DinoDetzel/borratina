import { Router } from 'express';

import { config } from '../config.js';
import { query, withTransaction } from '../db.js';
import { AppError } from '../middleware/errors.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validarNumeros } from '../utils/numeros.js';
import { armarComprobante, normalizarCodigo } from '../utils/comprobante.js';
import { condicionGanadora, esGanadora } from '../utils/ganadores.js';

const router = Router();

/** Columnas públicas de una jugada, con y sin el alias `j` de los JOIN. */
const COLUMNAS = [
  'id', 'codigo', 'sorteo_id', 'vendedor_id',
  'comprador_nombre', 'comprador_telefono',
  'numero_1', 'numero_2', 'numero_3', 'numero_4',
  'anulada', 'anulada_por', 'anulada_at', 'editada_por', 'numeros_anteriores',
  'created_at', 'updated_at',
];
const CAMPOS = COLUMNAS.join(', ');
const CAMPOS_J = COLUMNAS.map((c) => `j.${c}`).join(', ');

// La zona sale de `config` y no escrita acá: es la del club, y el vendedor que
// lee "la carga cierra el ..." tiene que leer la misma hora que ve en pantalla.
const FECHA_LARGA = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: config.zonaHoraria,
});

/**
 * Anota una anulación o una restauración en el historial (migración 013).
 *
 * `jugadas` guarda cómo está la jugada **hoy** —y el CHECK obliga a limpiar
 * `anulada_por` al restaurar—, así que sin esto no quedaría constancia de que
 * estuvo anulada. Va siempre dentro de la transacción de quien la llama: un
 * historial al que a veces le falta una entrada no sirve como historial.
 */
const registrarEvento = (client, jugadaId, tipo, usuarioId) =>
  client.query(
    'INSERT INTO jugadas_eventos (jugada_id, tipo, usuario_id) VALUES ($1, $2, $3)',
    [jugadaId, tipo, usuarioId],
  );

/**
 * Cuando el INSERT no engancha ningún sorteo hay tres motivos posibles y al
 * vendedor le sirve saber cuál: no hay sorteo, todavía no arrancó, o ya venció.
 * Se consulta recién acá, en el camino de error, para no pagarlo en cada carga.
 */
async function errorDeCarga() {
  const { rows } = await query(`
    SELECT inicia_at, finaliza_at,
           now() < inicia_at   AS aun_no_empezo,
           now() > finaliza_at AS ya_vencio
    FROM sorteos WHERE estado = 'abierto'
  `);
  const sorteo = rows[0];

  if (!sorteo) {
    return new AppError(409, 'No hay ningún sorteo con la carga abierta.');
  }
  // Sin punto final: el formato en español ya termina en "p. m.".
  if (sorteo.aun_no_empezo) {
    return new AppError(
      409,
      `La carga todavía no empezó — abre el ${FECHA_LARGA.format(sorteo.inicia_at)}`,
    );
  }
  if (sorteo.ya_vencio) {
    return new AppError(409, `La carga cerró el ${FECHA_LARGA.format(sorteo.finaliza_at)}`);
  }

  // La ventana está vigente: el sorteo se cerró entre el INSERT y esta consulta.
  return new AppError(409, 'El sorteo se cerró recién. No se pudo cargar la jugada.');
}

/** Valida y normaliza los datos del comprador que vienen del body. */
function validarComprador(body) {
  const nombre = String(body?.comprador_nombre ?? '').trim();
  if (!nombre) throw new AppError(400, 'El nombre del comprador es obligatorio.');
  if (nombre.length > 150) throw new AppError(400, 'El nombre del comprador es demasiado largo.');

  const telefonoCrudo = body?.comprador_telefono;
  const telefono = telefonoCrudo == null ? null : String(telefonoCrudo).trim() || null;
  if (telefono && telefono.length > 30) {
    throw new AppError(400, 'El teléfono del comprador es demasiado largo.');
  }

  return { nombre, telefono };
}

/**
 * POST /api/jugadas → carga una jugada en el sorteo abierto.
 * Body: { numeros: [n,n,n,n], comprador_nombre, comprador_telefono? }
 *
 * No se elige el sorteo: siempre se carga sobre el único que esté abierto.
 */
router.post('/', requireAuth, async (req, res) => {
  const numeros = validarNumeros(req.body?.numeros, 'numeros');
  const { nombre, telefono } = validarComprador(req.body);

  // INSERT ... SELECT en un solo paso: si el admin cierra el sorteo o vence la
  // ventana justo entre la lectura y la escritura, no se cuela ninguna jugada.
  // La condición de tiempo se evalúa en la base con su propio `now()`, así que no
  // depende del reloj de quien haga el request.
  //
  // El código de comprobante lo genera un trigger. Es aleatorio, así que puede
  // chocar con uno existente: reintentamos unas pocas veces. Con 30^6
  // combinaciones por día, llegar al segundo intento ya es rarísimo.
  const INTENTOS = 5;
  let jugada;

  for (let intento = 1; intento <= INTENTOS; intento += 1) {
    try {
      const { rows } = await query(
        `INSERT INTO jugadas
           (sorteo_id, vendedor_id, comprador_nombre, comprador_telefono,
            numero_1, numero_2, numero_3, numero_4)
         SELECT s.id, $1, $2, $3, $4, $5, $6, $7
         FROM sorteos s
         WHERE s.estado = 'abierto'
           AND now() BETWEEN s.inicia_at AND s.finaliza_at
         RETURNING ${CAMPOS}`,
        [req.user.id, nombre, telefono, ...numeros],
      );

      if (!rows[0]) throw await errorDeCarga();
      jugada = rows[0];
      break;
    } catch (err) {
      const chocoElCodigo = err.code === '23505' && err.constraint === 'jugadas_codigo_key';
      if (!chocoElCodigo || intento === INTENTOS) throw err;
    }
  }

  const { rows: sorteos } = await query(
    'SELECT periodo, estado, precio_jugada, pozo, finaliza_at FROM sorteos WHERE id = $1',
    [jugada.sorteo_id],
  );

  res.status(201).json({
    jugada,
    comprobante: armarComprobante({ ...jugada, vendedor: req.user.nombre }, sorteos[0]),
  });
});

/**
 * GET /api/jugadas → listado de jugadas.
 *
 * Un vendedor ve únicamente las suyas: el filtro por vendedor_id se impone
 * en el servidor, no se toma del query string.
 *
 * Query params: sorteo_id, vendedor_id (solo admin), comprador, numeros,
 *               incluir_anuladas, limit, offset.
 */
router.get('/', requireAuth, async (req, res) => {
  const condiciones = [];
  const params = [];
  const agregar = (sql, valor) => {
    params.push(valor);
    condiciones.push(sql.replace('?', `$${params.length}`));
  };

  // Por defecto, el sorteo abierto; si no hay ninguno, el más reciente.
  let sorteoId = req.query.sorteo_id;
  if (!sorteoId) {
    const { rows } = await query(`
      SELECT id FROM sorteos
      ORDER BY (estado = 'abierto') DESC, periodo DESC
      LIMIT 1
    `);
    if (!rows[0]) return res.json({ jugadas: [], total: 0 });
    sorteoId = rows[0].id;
  }
  agregar('j.sorteo_id = ?', sorteoId);

  if (req.user.rol === 'admin') {
    if (req.query.vendedor_id) agregar('j.vendedor_id = ?', req.query.vendedor_id);
  } else {
    // Regla dura: el vendedor solo ve lo suyo, sin importar qué mande el cliente.
    agregar('j.vendedor_id = ?', req.user.id);
  }

  if (req.query.comprador) {
    agregar('j.comprador_nombre ILIKE ?', `%${req.query.comprador}%`);
  }

  if (req.query.codigo) {
    agregar('j.codigo = ?', normalizarCodigo(req.query.codigo));
  }

  // Búsqueda por combinación: se normaliza igual que al guardar.
  if (req.query.numeros) {
    const crudos = String(req.query.numeros).split(',').map((n) => n.trim());
    const numeros = validarNumeros(crudos, 'numeros');
    numeros.forEach((n, i) => agregar(`j.numero_${i + 1} = ?`, n));
  }

  if (req.query.incluir_anuladas !== 'true') {
    condiciones.push('j.anulada = false');
  }

  // Solo las que cobran: es la lista con la que se pagan los premios, así que una
  // jugada anulada no entra aunque sus números coincidan.
  if (req.query.solo_ganadoras === 'true') {
    condiciones.push(
      `s.estado = 'finalizado' AND j.anulada = false AND ${condicionGanadora('j', 's')}`,
    );
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const offset = Number(req.query.offset) || 0;
  params.push(limit, offset);

  const { rows } = await query(
    // `gano` viene en NULL mientras el sorteo no esté finalizado: es distinto de
    // "no ganó". Con un extracto de 20 números, comparar a ojo es inviable, así
    // que la pantalla necesita el dato ya resuelto.
    // `sorteo_estado` va explícito y no deducido de `gano`: la pantalla lo
    // necesita para saber si todavía se pueden corregir los números.
    // `anulada_por` es un id y no le dice nada a nadie en pantalla: va también
    // el nombre. LEFT JOIN porque la enorme mayoría de las jugadas no está
    // anulada y ahí la columna es NULL.
    `SELECT ${CAMPOS_J}, u.nombre AS vendedor, s.estado AS sorteo_estado,
            anulador.nombre AS anulada_por_nombre,
            -- Cuántas veces se anuló, esté anulada ahora o no. Una jugada activa
            -- con esto en 1 o más estuvo anulada y alguien la restauró, que es
            -- justamente lo que antes no se veía en ningún lado.
            (SELECT COUNT(*) FROM jugadas_eventos e
              WHERE e.jugada_id = j.id AND e.tipo = 'anulada')::int AS veces_anulada,
            CASE WHEN s.estado = 'finalizado'
                 THEN (j.anulada = false AND ${condicionGanadora('j', 's')})
                 ELSE NULL
            END AS gano,
            COUNT(*) OVER() AS total
     FROM jugadas j
     JOIN usuarios u ON u.id = j.vendedor_id
     JOIN sorteos s ON s.id = j.sorteo_id
     LEFT JOIN usuarios anulador ON anulador.id = j.anulada_por
     ${where}
     ORDER BY j.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const total = rows[0]?.total ?? 0;
  res.json({
    jugadas: rows.map(({ total: _t, ...jugada }) => jugada),
    total,
    limit,
    offset,
  });
});

/**
 * GET /api/jugadas/comprobante/:codigo → busca una jugada por su comprobante.
 *
 * Es lo que se usa cuando un comprador se presenta con el papel en la mano.
 * Acepta el código con o sin guion y en minúsculas.
 *
 * Va antes que /:id, si no Express interpretaría "comprobante" como un id.
 */
router.get('/comprobante/:codigo', requireAuth, async (req, res) => {
  const codigo = normalizarCodigo(req.params.codigo);

  const { rows } = await query(
    `SELECT ${CAMPOS_J}, u.nombre AS vendedor,
            s.periodo, s.estado AS sorteo_estado, s.precio_jugada, s.pozo,
            s.finaliza_at, s.numeros AS extracto
     FROM jugadas j
     JOIN usuarios u ON u.id = j.vendedor_id
     JOIN sorteos s ON s.id = j.sorteo_id
     WHERE j.codigo = $1`,
    [codigo],
  );
  const fila = rows[0];

  if (!fila) throw new AppError(404, 'No existe ninguna jugada con ese código.');
  if (req.user.rol !== 'admin' && fila.vendedor_id !== req.user.id) {
    throw new AppError(404, 'No existe ninguna jugada con ese código.');
  }

  // Si el sorteo ya se sorteó, de paso le decimos si ganó.
  const sorteado = fila.sorteo_estado === 'finalizado';
  const gano =
    sorteado &&
    !fila.anulada &&
    esGanadora(
      [fila.numero_1, fila.numero_2, fila.numero_3, fila.numero_4],
      fila.extracto,
    );

  res.json({
    comprobante: armarComprobante(fila, {
      periodo: fila.periodo,
      estado: fila.sorteo_estado,
      precio_jugada: fila.precio_jugada,
      pozo: fila.pozo,
      finaliza_at: fila.finaliza_at,
    }),
    sorteado,
    extracto: fila.extracto,
    gano: sorteado ? gano : null,
  });
});

/** GET /api/jugadas/:id → una jugada. El vendedor solo puede ver las suyas. */
router.get('/:id', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT ${CAMPOS_J}, u.nombre AS vendedor
     FROM jugadas j
     JOIN usuarios u ON u.id = j.vendedor_id
     WHERE j.id = $1`,
    [req.params.id],
  );
  const jugada = rows[0];

  if (!jugada) throw new AppError(404, 'No existe esa jugada.');
  if (req.user.rol !== 'admin' && jugada.vendedor_id !== req.user.id) {
    // 404 y no 403: no le confirmamos a un vendedor qué jugadas cargaron los demás.
    throw new AppError(404, 'No existe esa jugada.');
  }

  // Quién la anuló y quién la restauró, en orden. Solo para el admin: al
  // vendedor no le corresponde saber qué hizo un admin con su jugada, y en su
  // pantalla no hay dónde mostrarlo.
  const historial =
    req.user.rol === 'admin'
      ? (
          await query(
            `SELECT e.tipo, e.created_at, u.nombre AS usuario
             FROM jugadas_eventos e
             JOIN usuarios u ON u.id = e.usuario_id
             WHERE e.jugada_id = $1
             ORDER BY e.created_at`,
            [jugada.id],
          )
        ).rows
      : undefined;

  res.json({ jugada, ...(historial ? { historial } : {}) });
});

/**
 * Por qué no entró la corrección: la jugada no existe, o su sorteo ya se
 * sorteó. Se averigua recién en el camino de error.
 */
async function errorDeCorreccion(jugadaId) {
  const { rows } = await query(
    `SELECT s.periodo FROM jugadas j JOIN sorteos s ON s.id = j.sorteo_id WHERE j.id = $1`,
    [jugadaId],
  );
  if (!rows[0]) return new AppError(404, 'No existe esa jugada.');

  return new AppError(
    409,
    `El sorteo de ${rows[0].periodo} ya tiene el extracto cargado: los números de una jugada ` +
      'no se pueden cambiar después del sorteo, porque eso cambia quién cobra. ' +
      'El nombre y el teléfono sí se pueden corregir.',
  );
}

/**
 * PATCH /api/jugadas/:id → corrige una jugada cargada por error. Solo admin.
 * Body: { numeros?, comprador_nombre?, comprador_telefono? }
 *
 * **Los números no se pueden cambiar una vez sorteado.** Con el extracto a la
 * vista, editar una jugada es elegir quién gana: alcanzaba con copiarle los
 * números al extracto para convertir un sorteo vacante en un premio cobrado.
 * Antes del sorteo la corrección es legítima (nadie sabe qué va a salir) y
 * queda registrada igual, con los números anteriores guardados.
 *
 * El nombre y el teléfono del comprador se corrigen siempre: no cambian quién
 * gana, y un apellido mal escrito hay que poder arreglarlo cuando el comprador
 * se presenta a cobrar.
 */
router.patch('/:id', requireAuth, requireAdmin, async (req, res) => {
  const sets = [];
  const params = [];
  const setear = (columna, valor) => {
    params.push(valor);
    sets.push(`${columna} = $${params.length}`);
  };

  const cambiaNumeros = req.body?.numeros !== undefined;

  if (cambiaNumeros) {
    const numeros = validarNumeros(req.body.numeros, 'numeros');
    numeros.forEach((n, i) => setear(`numero_${i + 1}`, n));

    // En un UPDATE, la derecha de un SET ve siempre la fila vieja: esto guarda
    // los números que la jugada tenía antes, en la misma sentencia que los pisa.
    sets.push('numeros_anteriores = ARRAY[numero_1, numero_2, numero_3, numero_4]');
  }
  if (req.body?.comprador_nombre !== undefined) {
    const { nombre } = validarComprador(req.body);
    setear('comprador_nombre', nombre);
  }
  if (req.body?.comprador_telefono !== undefined) {
    const telefono = req.body.comprador_telefono == null
      ? null
      : String(req.body.comprador_telefono).trim() || null;
    setear('comprador_telefono', telefono);
  }

  if (sets.length === 0) {
    throw new AppError(400, 'No hay nada para modificar.');
  }

  setear('editada_por', req.user.id);
  sets.push('updated_at = now()');
  params.push(req.params.id);

  // La condición del sorteo va dentro del UPDATE y no en un chequeo previo: si
  // el admin carga el extracto justo entre la lectura y la escritura, no se
  // cuela una corrección de números con el resultado ya a la vista.
  const sorteoSinSortear = cambiaNumeros
    ? `AND EXISTS (
         SELECT 1 FROM sorteos s
         WHERE s.id = jugadas.sorteo_id AND s.estado <> 'finalizado'
       )`
    : '';

  const { rows } = await query(
    `UPDATE jugadas SET ${sets.join(', ')}
     WHERE id = $${params.length} ${sorteoSinSortear}
     RETURNING ${CAMPOS}`,
    params,
  );
  if (!rows[0]) throw await errorDeCorreccion(req.params.id);

  res.json({ jugada: rows[0] });
});

/**
 * POST /api/jugadas/:id/anular → anula una jugada. Solo admin.
 * No borra la fila: la marca y deja registrado quién y cuándo.
 */
router.post('/:id/anular', requireAuth, requireAdmin, async (req, res) => {
  // El UPDATE y el evento van juntos o no van: un historial al que a veces le
  // falta una entrada no sirve como historial.
  const jugada = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE jugadas
       SET anulada = true, anulada_por = $1, anulada_at = now(), updated_at = now()
       WHERE id = $2 AND anulada = false
       RETURNING ${CAMPOS}`,
      [req.user.id, req.params.id],
    );

    if (!rows[0]) return null;

    await registrarEvento(client, rows[0].id, 'anulada', req.user.id);
    return rows[0];
  });

  if (!jugada) {
    const { rows: existe } = await query('SELECT anulada FROM jugadas WHERE id = $1', [req.params.id]);
    if (!existe[0]) throw new AppError(404, 'No existe esa jugada.');
    throw new AppError(409, 'La jugada ya estaba anulada.');
  }

  res.json({ jugada });
});

/**
 * Por qué no entró la restauración: la jugada no existe, no estaba anulada, o su
 * sorteo ya se sorteó. Se averigua recién en el camino de error.
 */
async function errorDeRestauracion(jugadaId) {
  const { rows } = await query(
    `SELECT j.anulada, s.periodo
     FROM jugadas j JOIN sorteos s ON s.id = j.sorteo_id
     WHERE j.id = $1`,
    [jugadaId],
  );
  const fila = rows[0];

  if (!fila) return new AppError(404, 'No existe esa jugada.');
  // Antes que el sorteo: si además no estaba anulada, eso es lo que hay que decir.
  if (!fila.anulada) return new AppError(409, 'La jugada no está anulada.');

  return new AppError(
    409,
    `El sorteo de ${fila.periodo} ya tiene el extracto cargado: una jugada anulada ` +
      'no se puede restaurar después del sorteo, porque eso cambia quién cobra. ' +
      'Si la anulación fue un error, hay que resolverlo fuera del sistema.',
  );
}

/**
 * POST /api/jugadas/:id/restaurar → revierte una anulación. Solo admin.
 *
 * **No se puede restaurar una vez sorteado**, por el mismo motivo que no se
 * pueden cambiar los números: con el extracto a la vista, restaurar es elegir
 * quién cobra. Y no hace falta inventar una jugada para aprovecharlo — alcanza
 * con anular varias mientras el sorteo está abierto, que es legítimo y habitual,
 * y restaurar después la que salió.
 *
 * Anular sigue abierto post-sorteo: quitar un cobrador no es lo mismo que
 * elegirlo, y hay casos reales (un comprobante que nunca se pagó y se detecta
 * tarde). Queda pendiente de definir si eso también se restringe.
 */
router.post('/:id/restaurar', requireAuth, requireAdmin, async (req, res) => {
  // La condición del sorteo va dentro del UPDATE y no en un chequeo previo: si el
  // admin carga el extracto justo entre la lectura y la escritura, no se cuela
  // una restauración con el resultado ya a la vista.
  const jugada = await withTransaction(async (client) => {
    const { rows } = await client.query(
      // `anulada_por` y `anulada_at` se nulifican porque el CHECK lo exige: son
      // el estado de hoy, no el historial. Quién anuló queda en jugadas_eventos
      // (migración 013), que es lo que sobrevive a esta restauración.
      `UPDATE jugadas
       SET anulada = false, anulada_por = NULL, anulada_at = NULL,
           updated_at = now()
       WHERE id = $1 AND anulada = true
         AND EXISTS (
           SELECT 1 FROM sorteos s
           WHERE s.id = jugadas.sorteo_id AND s.estado <> 'finalizado'
         )
       RETURNING ${CAMPOS}`,
      [req.params.id],
    );

    if (!rows[0]) return null;

    await registrarEvento(client, rows[0].id, 'restaurada', req.user.id);
    return rows[0];
  });

  if (!jugada) throw await errorDeRestauracion(req.params.id);

  res.json({ jugada });
});

export default router;
