import { Router } from 'express';

import { query, withTransaction } from '../db.js';
import { AppError } from '../middleware/errors.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validarExtracto } from '../utils/numeros.js';
import { condicionGanadora } from '../utils/ganadores.js';

const router = Router();

/** Columnas públicas de un sorteo. `alias` las prefija para queries con JOIN. */
const COLUMNAS = [
  'id', 'periodo', 'precio_jugada', 'pozo', 'estado',
  'inicia_at', 'finaliza_at',
  'numeros', 'numeros_anteriores',
  'fecha_cierre_carga', 'fecha_resultado', 'created_at',
  'resultado_corregido_at', 'resultado_corregido_por',
];
const CAMPOS = COLUMNAS.join(', ');
const camposCon = (alias) => COLUMNAS.map((c) => `${alias}.${c}`).join(', ');

/**
 * Valida la ventana de carga y devuelve las dos fechas como Date.
 *
 * Se aceptan en ISO (lo que manda el frontend a partir de un `datetime-local`).
 * No se valida que el inicio sea futuro: abrir un sorteo que arrancó hace una
 * hora es normal, y también cargarle una ventana que ya empezó.
 */
function validarVentana(iniciaAt, finalizaAt) {
  const inicia = new Date(iniciaAt ?? '');
  const finaliza = new Date(finalizaAt ?? '');

  if (Number.isNaN(inicia.getTime()) || Number.isNaN(finaliza.getTime())) {
    throw new AppError(400, 'Las fechas de inicio y fin de la carga son obligatorias.');
  }
  if (finaliza <= inicia) {
    throw new AppError(400, 'El cierre de la carga tiene que ser posterior al inicio.');
  }

  return { inicia, finaliza };
}

/**
 * Las jugadas que ganan un sorteo, según el extracto que tenga cargado en ese
 * momento.
 *
 * Por defecto va contra el pool. Dentro de una transacción hay que pasarle el
 * cliente, o no vería el extracto que se acaba de escribir.
 */
async function buscarGanadores(sorteoId, cliente = { query }) {
  const { rows } = await cliente.query(
    `SELECT j.id, j.comprador_nombre, j.comprador_telefono,
            j.numero_1, j.numero_2, j.numero_3, j.numero_4,
            u.id AS vendedor_id, u.nombre AS vendedor
     FROM jugadas j
     JOIN usuarios u ON u.id = j.vendedor_id
     JOIN sorteos s ON s.id = j.sorteo_id
     WHERE j.sorteo_id = $1
       AND j.anulada = false
       AND ${condicionGanadora('j', 's')}
     ORDER BY j.created_at`,
    [sorteoId],
  );
  return rows;
}

/** El reparto que acompaña a una lista de ganadores. */
const conReparto = (sorteo, ganadores) => ({
  sorteo,
  ganadores,
  vacante: ganadores.length === 0,
  premio_por_ganador: ganadores.length ? sorteo.pozo / ganadores.length : 0,
});

/** GET /api/sorteos → todos los sorteos, del más nuevo al más viejo. */
router.get('/', requireAuth, async (req, res) => {
  const { rows } = await query(`SELECT ${CAMPOS} FROM sorteos ORDER BY periodo DESC`);
  res.json({ sorteos: rows });
});

/**
 * GET /api/sorteos/actual → el sorteo con la carga abierta.
 * Es lo primero que consulta la pantalla del vendedor.
 *
 * El `pozo` es fijo y viene de la propia fila; lo que se calcula acá es la
 * recaudación, que es otra cosa: lo que se lleva vendido.
 *
 * Un vendedor recibe únicamente `mis_jugadas`. El total del sorteo y la
 * recaudación son del admin: dárselos al vendedor sería contarle cuánto vendieron
 * los demás, que es justo lo que la regla de visibilidad no permite.
 *
 * Va antes que /:id para que "actual" no se interprete como un id.
 */
router.get('/actual', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT ${camposCon('s')},
            COUNT(j.id) FILTER (WHERE j.vendedor_id = $1) AS mis_jugadas,
            COUNT(j.id) AS jugadas_cargadas,
            COUNT(j.id) * s.precio_jugada AS recaudacion,
            -- El estado dice 'abierto', pero si la ventana todavía no empezó o
            -- ya venció no se puede cargar. La pantalla necesita saberlo para
            -- avisar antes de que el vendedor complete el formulario.
            (now() BETWEEN s.inicia_at AND s.finaliza_at) AS carga_vigente,
            (now() < s.inicia_at)   AS aun_no_empezo,
            (now() > s.finaliza_at) AS ya_vencio
     FROM sorteos s
     LEFT JOIN jugadas j ON j.sorteo_id = s.id AND j.anulada = false
     WHERE s.estado = 'abierto'
     GROUP BY s.id`,
    [req.user.id],
  );

  if (!rows[0]) {
    throw new AppError(404, 'No hay ningún sorteo con la carga abierta.');
  }

  const sorteo = rows[0];
  if (req.user.rol !== 'admin') {
    delete sorteo.jugadas_cargadas;
    delete sorteo.recaudacion;
  }

  res.json({ sorteo });
});

/** GET /api/sorteos/:id */
router.get('/:id', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT ${camposCon('s')}, u.nombre AS corregido_por
     FROM sorteos s
     LEFT JOIN usuarios u ON u.id = s.resultado_corregido_por
     WHERE s.id = $1`,
    [req.params.id],
  );
  if (!rows[0]) throw new AppError(404, 'No existe ese sorteo.');
  res.json({ sorteo: rows[0] });
});

/**
 * POST /api/sorteos → abre el sorteo del mes. Solo admin.
 * Body: { periodo: 'AAAA-MM', precio_jugada: number }
 *
 * El índice único parcial de la base garantiza que no haya dos abiertos a la vez;
 * si pasa, el handler de errores lo traduce a un 409 con mensaje claro.
 */
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { periodo, precio_jugada, pozo, inicia_at, finaliza_at } = req.body ?? {};

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo ?? '')) {
    throw new AppError(400, 'El período debe tener el formato AAAA-MM (ej: 2026-08).');
  }

  const precio = Number(precio_jugada);
  if (!Number.isFinite(precio) || precio <= 0) {
    throw new AppError(400, 'El precio por jugada debe ser un número mayor a cero.');
  }

  // El pozo es el premio anunciado y no depende de cuánto se venda.
  const premio = Number(pozo);
  if (!Number.isFinite(premio) || premio <= 0) {
    throw new AppError(400, 'El pozo debe ser un número mayor a cero.');
  }

  const { inicia, finaliza } = validarVentana(inicia_at, finaliza_at);

  const { rows } = await query(
    `INSERT INTO sorteos (periodo, precio_jugada, pozo, inicia_at, finaliza_at, estado)
     VALUES ($1, $2, $3, $4, $5, 'abierto')
     RETURNING ${CAMPOS}`,
    [periodo, precio, premio, inicia, finaliza],
  );

  res.status(201).json({ sorteo: rows[0] });
});

/**
 * PATCH /api/sorteos/:id/ventana → corrige las fechas de carga. Solo admin.
 * Igual que el pozo: solo mientras el sorteo esté abierto.
 */
router.patch('/:id/ventana', requireAuth, requireAdmin, async (req, res) => {
  const { inicia, finaliza } = validarVentana(req.body?.inicia_at, req.body?.finaliza_at);

  const { rows } = await query(
    `UPDATE sorteos SET inicia_at = $1, finaliza_at = $2
     WHERE id = $3 AND estado = 'abierto'
     RETURNING ${CAMPOS}`,
    [inicia, finaliza, req.params.id],
  );

  if (!rows[0]) {
    const { rows: existe } = await query('SELECT estado FROM sorteos WHERE id = $1', [req.params.id]);
    if (!existe[0]) throw new AppError(404, 'No existe ese sorteo.');
    throw new AppError(409, `El sorteo ya está ${existe[0].estado}: las fechas no se pueden cambiar.`);
  }

  res.json({ sorteo: rows[0] });
});

/**
 * PATCH /api/sorteos/:id/pozo → corrige el pozo anunciado. Solo admin.
 *
 * Solo mientras el sorteo esté abierto: una vez cerrada la carga, el premio ya
 * se les comunicó a los compradores y cambiarlo sería cambiar las reglas con las
 * jugadas hechas.
 */
router.patch('/:id/pozo', requireAuth, requireAdmin, async (req, res) => {
  const premio = Number(req.body?.pozo);
  if (!Number.isFinite(premio) || premio <= 0) {
    throw new AppError(400, 'El pozo debe ser un número mayor a cero.');
  }

  const { rows } = await query(
    `UPDATE sorteos SET pozo = $1
     WHERE id = $2 AND estado = 'abierto'
     RETURNING ${CAMPOS}`,
    [premio, req.params.id],
  );

  if (!rows[0]) {
    const { rows: existe } = await query('SELECT estado FROM sorteos WHERE id = $1', [req.params.id]);
    if (!existe[0]) throw new AppError(404, 'No existe ese sorteo.');
    throw new AppError(409, `El sorteo ya está ${existe[0].estado}: el pozo no se puede cambiar.`);
  }

  res.json({ sorteo: rows[0] });
});

/** PATCH /api/sorteos/:id/cerrar → corta la carga de jugadas. Solo admin. */
router.patch('/:id/cerrar', requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await query(
    `UPDATE sorteos
     SET estado = 'cerrado', fecha_cierre_carga = now()
     WHERE id = $1 AND estado = 'abierto'
     RETURNING ${CAMPOS}`,
    [req.params.id],
  );

  if (!rows[0]) {
    // O no existe, o ya no estaba abierto: distinguimos para dar un mensaje útil.
    const { rows: existe } = await query('SELECT estado FROM sorteos WHERE id = $1', [req.params.id]);
    if (!existe[0]) throw new AppError(404, 'No existe ese sorteo.');
    throw new AppError(409, `El sorteo ya está ${existe[0].estado}, no se puede cerrar.`);
  }

  res.json({ sorteo: rows[0] });
});

/**
 * POST /api/sorteos/:id/resultado → carga el resultado oficial y finaliza. Solo admin.
 * Body: { numeros: [n, n, n, n] }
 *
 * El pozo no se toca: es fijo desde que se abrió el sorteo. Antes había que
 * congelarlo acá porque se calculaba a partir de las jugadas y anular una
 * después habría cambiado el histórico.
 */
router.post('/:id/resultado', requireAuth, requireAdmin, async (req, res) => {
  const extracto = validarExtracto(req.body?.numeros, 'numeros');

  const resultado = await withTransaction(async (client) => {
    // FOR UPDATE: si dos admins cargan el resultado a la vez, uno espera al otro.
    const { rows: actuales } = await client.query(
      'SELECT id, estado FROM sorteos WHERE id = $1 FOR UPDATE',
      [req.params.id],
    );
    const sorteo = actuales[0];

    if (!sorteo) throw new AppError(404, 'No existe ese sorteo.');
    if (sorteo.estado === 'abierto') {
      throw new AppError(409, 'Cerrá la carga de jugadas antes de cargar el resultado.');
    }
    if (sorteo.estado === 'finalizado') {
      throw new AppError(409, 'Este sorteo ya está finalizado.');
    }

    const { rows: actualizados } = await client.query(
      `UPDATE sorteos
       SET numeros = $1, estado = 'finalizado', fecha_resultado = now()
       WHERE id = $2
       RETURNING ${CAMPOS}`,
      [extracto, sorteo.id],
    );

    const ganadores = await buscarGanadores(sorteo.id, client);
    return { sorteo: actualizados[0], ganadores };
  });

  res.json(conReparto(resultado.sorteo, resultado.ganadores));
});

/**
 * PATCH /api/sorteos/:id/resultado → corrige el extracto ya cargado. Solo admin.
 * Body: { numeros: [20 números] }
 *
 * Son 20 números que alguien tipea leyendo la pizarra: un dedazo en uno solo
 * cambia quién cobra. Corregir queda registrado (quién, cuándo y qué extracto
 * había antes) y la respuesta trae los ganadores de antes y los de ahora, que
 * es lo único que le importa a quien corrige: a quién hay que avisarle.
 */
router.patch('/:id/resultado', requireAuth, requireAdmin, async (req, res) => {
  const extracto = validarExtracto(req.body?.numeros, 'numeros');

  const resultado = await withTransaction(async (client) => {
    const { rows: actuales } = await client.query(
      'SELECT id, estado, numeros FROM sorteos WHERE id = $1 FOR UPDATE',
      [req.params.id],
    );
    const sorteo = actuales[0];

    if (!sorteo) throw new AppError(404, 'No existe ese sorteo.');
    if (sorteo.estado !== 'finalizado') {
      throw new AppError(
        409,
        'Este sorteo todavía no tiene extracto: primero se carga, después se corrige.',
      );
    }

    const sinCambios =
      sorteo.numeros.length === extracto.length &&
      sorteo.numeros.every((n, i) => n === extracto[i]);
    if (sinCambios) {
      throw new AppError(400, 'El extracto es igual al que ya estaba cargado.');
    }

    // Antes de pisarlo: quiénes ganaban con el extracto viejo.
    const antes = await buscarGanadores(sorteo.id, client);

    const { rows: actualizados } = await client.query(
      `UPDATE sorteos
       SET numeros = $1,
           numeros_anteriores = numeros,
           resultado_corregido_at = now(),
           resultado_corregido_por = $2
       WHERE id = $3
       RETURNING ${CAMPOS}`,
      [extracto, req.user.id, sorteo.id],
    );

    return { sorteo: actualizados[0], antes, ahora: await buscarGanadores(sorteo.id, client) };
  });

  const { sorteo, antes, ahora } = resultado;
  const ids = new Set(ahora.map((g) => g.id));

  res.json({
    ...conReparto(sorteo, ahora),
    ganadores_antes: antes,
    // Los que cobraban con el extracto equivocado y ahora no. Es a quienes hay
    // que avisarles, así que se dicen aparte en vez de dejar que el admin
    // compare dos listas a ojo.
    dejaron_de_ganar: antes.filter((g) => !ids.has(g.id)),
  });
});

/** GET /api/sorteos/:id/ganadores → ganadores y reparto de un sorteo finalizado. */
router.get('/:id/ganadores', requireAuth, requireAdmin, async (req, res) => {
  const { rows: sorteos } = await query(
    `SELECT ${CAMPOS} FROM sorteos WHERE id = $1`,
    [req.params.id],
  );
  const sorteo = sorteos[0];

  if (!sorteo) throw new AppError(404, 'No existe ese sorteo.');
  if (sorteo.estado !== 'finalizado') {
    throw new AppError(409, 'El sorteo todavía no tiene resultado cargado.');
  }

  res.json(conReparto(sorteo, await buscarGanadores(sorteo.id)));
});

export default router;
