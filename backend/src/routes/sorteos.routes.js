import { Router } from 'express';

import { query, withTransaction } from '../db.js';
import { AppError } from '../middleware/errors.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validarNumeros } from '../utils/numeros.js';

const router = Router();

/** Columnas públicas de un sorteo. `alias` las prefija para queries con JOIN. */
const COLUMNAS = [
  'id', 'periodo', 'precio_jugada', 'estado',
  'numero_1', 'numero_2', 'numero_3', 'numero_4',
  'fecha_cierre_carga', 'fecha_resultado', 'pozo_total', 'created_at',
];
const CAMPOS = COLUMNAS.join(', ');
const camposCon = (alias) => COLUMNAS.map((c) => `${alias}.${c}`).join(', ');

/** GET /api/sorteos → todos los sorteos, del más nuevo al más viejo. */
router.get('/', requireAuth, async (req, res) => {
  const { rows } = await query(`SELECT ${CAMPOS} FROM sorteos ORDER BY periodo DESC`);
  res.json({ sorteos: rows });
});

/**
 * GET /api/sorteos/actual → el sorteo con la carga abierta, con su pozo en vivo.
 * Es lo primero que consulta la pantalla del vendedor.
 * Va antes que /:id para que "actual" no se interprete como un id.
 */
router.get('/actual', requireAuth, async (req, res) => {
  const { rows } = await query(`
    SELECT ${camposCon('s')},
           COUNT(j.id) AS jugadas_cargadas,
           COUNT(j.id) * s.precio_jugada AS pozo_actual
    FROM sorteos s
    LEFT JOIN jugadas j ON j.sorteo_id = s.id AND j.anulada = false
    WHERE s.estado = 'abierto'
    GROUP BY s.id
  `);

  if (!rows[0]) {
    throw new AppError(404, 'No hay ningún sorteo con la carga abierta.');
  }
  res.json({ sorteo: rows[0] });
});

/** GET /api/sorteos/:id */
router.get('/:id', requireAuth, async (req, res) => {
  const { rows } = await query(`SELECT ${CAMPOS} FROM sorteos WHERE id = $1`, [req.params.id]);
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
  const { periodo, precio_jugada } = req.body ?? {};

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo ?? '')) {
    throw new AppError(400, 'El período debe tener el formato AAAA-MM (ej: 2026-08).');
  }
  const precio = Number(precio_jugada);
  if (!Number.isFinite(precio) || precio <= 0) {
    throw new AppError(400, 'El precio por jugada debe ser un número mayor a cero.');
  }

  const { rows } = await query(
    `INSERT INTO sorteos (periodo, precio_jugada, estado)
     VALUES ($1, $2, 'abierto')
     RETURNING ${CAMPOS}`,
    [periodo, precio],
  );

  res.status(201).json({ sorteo: rows[0] });
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
 * Además de guardar los números (normalizados), congela el pozo en `pozo_total`
 * para que el histórico no cambie si después se anula alguna jugada.
 */
router.post('/:id/resultado', requireAuth, requireAdmin, async (req, res) => {
  const numeros = validarNumeros(req.body?.numeros, 'numeros');

  const resultado = await withTransaction(async (client) => {
    // FOR UPDATE: si dos admins cargan el resultado a la vez, uno espera al otro.
    const { rows: actuales } = await client.query(
      'SELECT id, estado, precio_jugada FROM sorteos WHERE id = $1 FOR UPDATE',
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

    const { rows: conteo } = await client.query(
      'SELECT COUNT(*) AS jugadas FROM jugadas WHERE sorteo_id = $1 AND anulada = false',
      [sorteo.id],
    );
    const pozo = conteo[0].jugadas * sorteo.precio_jugada;

    const { rows: actualizados } = await client.query(
      `UPDATE sorteos
       SET numero_1 = $1, numero_2 = $2, numero_3 = $3, numero_4 = $4,
           estado = 'finalizado', fecha_resultado = now(), pozo_total = $5
       WHERE id = $6
       RETURNING ${CAMPOS}`,
      [...numeros, pozo, sorteo.id],
    );

    const { rows: ganadores } = await client.query(
      `SELECT j.id, j.comprador_nombre, j.comprador_telefono,
              j.numero_1, j.numero_2, j.numero_3, j.numero_4,
              u.id AS vendedor_id, u.nombre AS vendedor
       FROM jugadas j
       JOIN usuarios u ON u.id = j.vendedor_id
       JOIN sorteos s ON s.id = j.sorteo_id
       WHERE j.sorteo_id = $1
         AND j.anulada = false
         AND j.numero_1 = s.numero_1 AND j.numero_2 = s.numero_2
         AND j.numero_3 = s.numero_3 AND j.numero_4 = s.numero_4
       ORDER BY j.created_at`,
      [sorteo.id],
    );

    return { sorteo: actualizados[0], ganadores };
  });

  const { sorteo, ganadores } = resultado;
  res.json({
    sorteo,
    ganadores,
    vacante: ganadores.length === 0,
    premio_por_ganador: ganadores.length ? sorteo.pozo_total / ganadores.length : 0,
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

  const { rows: ganadores } = await query(
    `SELECT j.id, j.comprador_nombre, j.comprador_telefono,
            j.numero_1, j.numero_2, j.numero_3, j.numero_4,
            u.id AS vendedor_id, u.nombre AS vendedor
     FROM jugadas j
     JOIN usuarios u ON u.id = j.vendedor_id
     JOIN sorteos s ON s.id = j.sorteo_id
     WHERE j.sorteo_id = $1
       AND j.anulada = false
       AND j.numero_1 = s.numero_1 AND j.numero_2 = s.numero_2
       AND j.numero_3 = s.numero_3 AND j.numero_4 = s.numero_4
     ORDER BY j.created_at`,
    [sorteo.id],
  );

  res.json({
    sorteo,
    ganadores,
    vacante: ganadores.length === 0,
    premio_por_ganador: ganadores.length ? sorteo.pozo_total / ganadores.length : 0,
  });
});

export default router;
