/**
 * Error esperable, con un status HTTP y un mensaje que sí se le muestra al
 * cliente. Todo lo que no sea un AppError se trata como bug y se responde 500
 * sin filtrar detalles internos.
 */
export class AppError extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
    this.name = 'AppError';
  }
}

/** Códigos de error de Postgres que sabemos traducir a una respuesta útil. */
const ERRORES_PG = {
  '23505': { status: 409, mensaje: 'Ya existe un registro con esos datos.' },
  '23503': { status: 400, mensaje: 'Referencia inválida: el registro relacionado no existe.' },
  '23514': { status: 400, mensaje: 'Los datos no cumplen una restricción de la base.' },
};

/** Mensajes más específicos según qué constraint concreta reventó. */
const MENSAJES_POR_CONSTRAINT = {
  idx_sorteo_abierto_unico: 'Ya hay un sorteo con la carga abierta. Cerralo antes de abrir otro.',
  sorteos_periodo_key: 'Ya existe un sorteo para ese período.',
  usuarios_email_key: 'Ya existe un usuario con ese email.',
  chk_jugadas_orden: 'Los números deben guardarse ordenados. Es un bug: no se normalizaron antes de insertar.',
  chk_sorteos_orden: 'Los números del resultado deben guardarse ordenados. Es un bug: no se normalizaron antes de insertar.',
  chk_sorteos_finalizado: 'No se puede finalizar un sorteo sin cargar el resultado.',
};

export function notFoundHandler(req, res) {
  res.status(404).json({ error: `No existe la ruta ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars -- Express identifica el handler de errores por sus 4 parámetros
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message });
  }

  if (err.code && ERRORES_PG[err.code]) {
    const { status, mensaje } = ERRORES_PG[err.code];
    const especifico = MENSAJES_POR_CONSTRAINT[err.constraint];
    return res.status(status).json({ error: especifico || mensaje });
  }

  // JSON malformado en el body
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo del request no es JSON válido.' });
  }

  console.error('Error no controlado:', err);
  return res.status(500).json({ error: 'Error interno del servidor.' });
}
