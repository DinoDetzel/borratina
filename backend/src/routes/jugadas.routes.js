import { Router } from 'express';

import { query } from '../db.js';
import { AppError } from '../middleware/errors.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validarNumeros } from '../utils/numeros.js';

const router = Router();

/** Columnas públicas de una jugada, con y sin el alias `j` de los JOIN. */
const COLUMNAS = [
  'id', 'sorteo_id', 'vendedor_id',
  'comprador_nombre', 'comprador_telefono',
  'numero_1', 'numero_2', 'numero_3', 'numero_4',
  'anulada', 'anulada_por', 'anulada_at', 'editada_por',
  'created_at', 'updated_at',
];
const CAMPOS = COLUMNAS.join(', ');
const CAMPOS_J = COLUMNAS.map((c) => `j.${c}`).join(', ');

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

  // INSERT ... SELECT en un solo paso: si el admin cierra el sorteo justo entre
  // la lectura y la escritura, no se cuela ninguna jugada. Inserta 0 filas si no
  // hay sorteo abierto.
  const { rows } = await query(
    `INSERT INTO jugadas
       (sorteo_id, vendedor_id, comprador_nombre, comprador_telefono,
        numero_1, numero_2, numero_3, numero_4)
     SELECT s.id, $1, $2, $3, $4, $5, $6, $7
     FROM sorteos s
     WHERE s.estado = 'abierto'
     RETURNING ${CAMPOS}`,
    [req.user.id, nombre, telefono, ...numeros],
  );

  if (!rows[0]) {
    throw new AppError(409, 'No hay ningún sorteo con la carga abierta.');
  }

  res.status(201).json({ jugada: rows[0] });
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

  // Búsqueda por combinación: se normaliza igual que al guardar.
  if (req.query.numeros) {
    const crudos = String(req.query.numeros).split(',').map((n) => n.trim());
    const numeros = validarNumeros(crudos, 'numeros');
    numeros.forEach((n, i) => agregar(`j.numero_${i + 1} = ?`, n));
  }

  if (req.query.incluir_anuladas !== 'true') {
    condiciones.push('j.anulada = false');
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const offset = Number(req.query.offset) || 0;
  params.push(limit, offset);

  const { rows } = await query(
    `SELECT ${CAMPOS_J}, u.nombre AS vendedor,
            COUNT(*) OVER() AS total
     FROM jugadas j
     JOIN usuarios u ON u.id = j.vendedor_id
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

  res.json({ jugada });
});

/**
 * PATCH /api/jugadas/:id → corrige una jugada cargada por error. Solo admin.
 * Body: { numeros?, comprador_nombre?, comprador_telefono? }
 */
router.patch('/:id', requireAuth, requireAdmin, async (req, res) => {
  const sets = [];
  const params = [];
  const setear = (columna, valor) => {
    params.push(valor);
    sets.push(`${columna} = $${params.length}`);
  };

  if (req.body?.numeros !== undefined) {
    const numeros = validarNumeros(req.body.numeros, 'numeros');
    numeros.forEach((n, i) => setear(`numero_${i + 1}`, n));
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

  const { rows } = await query(
    `UPDATE jugadas SET ${sets.join(', ')}
     WHERE id = $${params.length}
     RETURNING ${CAMPOS}`,
    params,
  );
  if (!rows[0]) throw new AppError(404, 'No existe esa jugada.');

  res.json({ jugada: rows[0] });
});

/**
 * POST /api/jugadas/:id/anular → anula una jugada. Solo admin.
 * No borra la fila: la marca y deja registrado quién y cuándo.
 */
router.post('/:id/anular', requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await query(
    `UPDATE jugadas
     SET anulada = true, anulada_por = $1, anulada_at = now(), updated_at = now()
     WHERE id = $2 AND anulada = false
     RETURNING ${CAMPOS}`,
    [req.user.id, req.params.id],
  );

  if (!rows[0]) {
    const { rows: existe } = await query('SELECT anulada FROM jugadas WHERE id = $1', [req.params.id]);
    if (!existe[0]) throw new AppError(404, 'No existe esa jugada.');
    throw new AppError(409, 'La jugada ya estaba anulada.');
  }

  res.json({ jugada: rows[0] });
});

/** POST /api/jugadas/:id/restaurar → revierte una anulación. Solo admin. */
router.post('/:id/restaurar', requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await query(
    `UPDATE jugadas
     SET anulada = false, anulada_por = NULL, anulada_at = NULL,
         editada_por = $1, updated_at = now()
     WHERE id = $2 AND anulada = true
     RETURNING ${CAMPOS}`,
    [req.user.id, req.params.id],
  );

  if (!rows[0]) {
    const { rows: existe } = await query('SELECT anulada FROM jugadas WHERE id = $1', [req.params.id]);
    if (!existe[0]) throw new AppError(404, 'No existe esa jugada.');
    throw new AppError(409, 'La jugada no está anulada.');
  }

  res.json({ jugada: rows[0] });
});

export default router;
