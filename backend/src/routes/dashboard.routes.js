import { Router } from 'express';

import { query } from '../db.js';
import { AppError } from '../middleware/errors.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Todo el dashboard es exclusivo del admin: el vendedor tiene su pantalla simple
// (formulario + listado propio) y no ve estadísticas de nadie.
router.use(requireAuth, requireAdmin);

/** Resuelve el sorteo a analizar: el pedido, o el abierto, o el más reciente. */
async function resolverSorteoId(sorteoIdPedido) {
  if (sorteoIdPedido) {
    const { rows } = await query('SELECT id FROM sorteos WHERE id = $1', [sorteoIdPedido]);
    if (!rows[0]) throw new AppError(404, 'No existe ese sorteo.');
    return rows[0].id;
  }

  const { rows } = await query(`
    SELECT id FROM sorteos
    ORDER BY (estado = 'abierto') DESC, periodo DESC
    LIMIT 1
  `);
  if (!rows[0]) throw new AppError(404, 'Todavía no hay ningún sorteo creado.');
  return rows[0].id;
}

/**
 * GET /api/dashboard/resumen?sorteo_id=
 * Panel principal: estado del sorteo, pozo acumulado y totales.
 */
router.get('/resumen', async (req, res) => {
  const sorteoId = await resolverSorteoId(req.query.sorteo_id);

  const { rows } = await query(
    `SELECT s.id, s.periodo, s.estado, s.precio_jugada,
            s.numero_1, s.numero_2, s.numero_3, s.numero_4,
            s.fecha_cierre_carga, s.fecha_resultado, s.pozo_total,
            COUNT(j.id) FILTER (WHERE j.anulada = false) AS jugadas_validas,
            COUNT(j.id) FILTER (WHERE j.anulada = true)  AS jugadas_anuladas,
            COUNT(DISTINCT j.vendedor_id) FILTER (WHERE j.anulada = false) AS vendedores_activos,
            COUNT(j.id) FILTER (WHERE j.anulada = false) * s.precio_jugada AS pozo_actual
     FROM sorteos s
     LEFT JOIN jugadas j ON j.sorteo_id = s.id
     WHERE s.id = $1
     GROUP BY s.id`,
    [sorteoId],
  );

  const sorteo = rows[0];

  // Ya finalizado: el pozo que vale es el congelado, no el recalculado.
  const pozo = sorteo.estado === 'finalizado' ? sorteo.pozo_total : sorteo.pozo_actual;

  res.json({ resumen: { ...sorteo, pozo } });
});

/**
 * GET /api/dashboard/por-vendedor?sorteo_id=
 * Cuántas jugadas cargó y cuánto recaudó cada vendedor.
 */
router.get('/por-vendedor', async (req, res) => {
  const sorteoId = await resolverSorteoId(req.query.sorteo_id);

  const { rows } = await query(
    `SELECT u.id, u.nombre, u.email,
            COUNT(j.id) AS cantidad_jugadas,
            COUNT(j.id) * s.precio_jugada AS recaudacion
     FROM jugadas j
     JOIN usuarios u ON u.id = j.vendedor_id
     JOIN sorteos s ON s.id = j.sorteo_id
     WHERE j.sorteo_id = $1 AND j.anulada = false
     GROUP BY u.id, u.nombre, u.email, s.precio_jugada
     ORDER BY cantidad_jugadas DESC, u.nombre`,
    [sorteoId],
  );

  res.json({ sorteo_id: sorteoId, vendedores: rows });
});

/**
 * GET /api/dashboard/ventas?sorteo_id=
 * Serie diaria de jugadas para el gráfico de evolución de ventas.
 */
router.get('/ventas', async (req, res) => {
  const sorteoId = await resolverSorteoId(req.query.sorteo_id);

  const { rows } = await query(
    // Se agrupa en un CTE y recién después se calcula el acumulado y se formatea
    // el día. Mezclar el GROUP BY con la window function en un solo SELECT obliga
    // a repetir la expresión de la fecha en tres lugares y basta con que una no
    // coincida para que Postgres rechace la query.
    //
    // `dia` sale como texto 'AAAA-MM-DD' y no como date: tipado como fecha, el
    // driver lo convierte a un Date de JS y el JSON termina con un timestamp
    // corrido por la zona horaria, molesto para el eje del gráfico.
    `WITH por_dia AS (
       SELECT date_trunc('day', j.created_at)::date AS dia,
              COUNT(*) AS jugadas_del_dia,
              COUNT(*) * s.precio_jugada AS recaudacion_del_dia
       FROM jugadas j
       JOIN sorteos s ON s.id = j.sorteo_id
       WHERE j.sorteo_id = $1 AND j.anulada = false
       GROUP BY 1, s.precio_jugada
     )
     SELECT to_char(dia, 'YYYY-MM-DD') AS dia,
            jugadas_del_dia,
            recaudacion_del_dia,
            SUM(jugadas_del_dia) OVER (ORDER BY dia) AS jugadas_acumuladas
     FROM por_dia
     ORDER BY dia`,
    [sorteoId],
  );

  res.json({ sorteo_id: sorteoId, serie: rows });
});

/**
 * GET /api/dashboard/historial
 * Sorteos finalizados con su pozo y cuántos ganadores hubo.
 */
router.get('/historial', async (req, res) => {
  const { rows } = await query(`
    SELECT s.id, s.periodo, s.precio_jugada,
           s.numero_1, s.numero_2, s.numero_3, s.numero_4,
           s.fecha_resultado, s.pozo_total,
           COUNT(j.id) AS cantidad_ganadores,
           CASE WHEN COUNT(j.id) = 0 THEN 0
                ELSE s.pozo_total / COUNT(j.id)
           END AS premio_por_ganador,
           COUNT(j.id) = 0 AS vacante
    FROM sorteos s
    LEFT JOIN jugadas j ON j.sorteo_id = s.id AND j.anulada = false
        AND j.numero_1 = s.numero_1 AND j.numero_2 = s.numero_2
        AND j.numero_3 = s.numero_3 AND j.numero_4 = s.numero_4
    WHERE s.estado = 'finalizado'
    GROUP BY s.id
    ORDER BY s.periodo DESC
  `);

  res.json({ historial: rows });
});

/**
 * GET /api/dashboard/numeros-mas-jugados?sorteo_id=&limit=
 * Ranking de combinaciones más repetidas. Sirve para dimensionar el riesgo:
 * si sale una combinación muy jugada, el pozo se reparte entre muchos.
 */
router.get('/numeros-mas-jugados', async (req, res) => {
  const sorteoId = await resolverSorteoId(req.query.sorteo_id);
  const limit = Math.min(Number(req.query.limit) || 10, 100);

  const { rows } = await query(
    `SELECT numero_1, numero_2, numero_3, numero_4, COUNT(*) AS veces
     FROM jugadas
     WHERE sorteo_id = $1 AND anulada = false
     GROUP BY numero_1, numero_2, numero_3, numero_4
     HAVING COUNT(*) > 1
     ORDER BY veces DESC, numero_1, numero_2, numero_3, numero_4
     LIMIT $2`,
    [sorteoId, limit],
  );

  res.json({ sorteo_id: sorteoId, combinaciones: rows });
});

export default router;
