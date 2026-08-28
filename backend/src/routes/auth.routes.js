import { Router } from 'express';
import bcrypt from 'bcryptjs';

import { config } from '../config.js';
import { query } from '../db.js';
import { AppError } from '../middleware/errors.js';
import { firmarToken, requireAuth, requireAdmin } from '../middleware/auth.js';
import { limpiarIntentos, registrarFallo, verificarIntentos } from '../utils/intentos-de-login.js';

const router = Router();

/**
 * Deja el nombre de usuario en su forma canónica: minúsculas y sin espacios
 * alrededor. Se aplica tanto al crear la cuenta como al buscarla, así que
 * "Dino" y "dino " entran igual.
 */
const normalizarUsuario = (valor) => String(valor ?? '').trim().toLowerCase();

const FORMATO_USUARIO = /^[a-z0-9._-]{3,30}$/;

const FORMATO_INVALIDO =
  'El usuario debe tener entre 3 y 30 caracteres, y solo puede llevar letras, ' +
  'números, punto, guion o guion bajo (sin espacios ni acentos).';

/** POST /api/auth/login → { token, usuario } */
router.post('/login', async (req, res) => {
  const { usuario: nombreUsuario, password } = req.body ?? {};

  if (!nombreUsuario || !password) {
    throw new AppError(400, 'Usuario y contraseña son obligatorios.');
  }

  const clave = normalizarUsuario(nombreUsuario);

  // Antes de la base y antes de bcrypt: un intento frenado no cuesta nada. Se
  // cuenta por cuenta y no por IP, para no dejar afuera a todos los vendedores
  // cuando comparten la red del club — el porqué completo está en el módulo.
  verificarIntentos(clave);

  const { rows } = await query(
    `SELECT id, nombre, usuario, rol, activo, password_hash
     FROM usuarios WHERE usuario = $1`,
    [clave],
  );
  const usuario = rows[0];

  // Mismo mensaje para cuenta inexistente y contraseña incorrecta: no le
  // regalamos a nadie la información de qué usuarios están registrados.
  const credencialesInvalidas = new AppError(401, 'Usuario o contraseña incorrectos.');

  if (!usuario) {
    // Hasheamos igual para que el tiempo de respuesta no delate si existe.
    await bcrypt.compare(password, '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva');
    // También se cuenta contra un usuario que no existe: si no, probar nombres
    // inventados sería gratis y el freno delataría cuáles están registrados.
    registrarFallo(clave);
    throw credencialesInvalidas;
  }

  const coincide = await bcrypt.compare(password, usuario.password_hash);
  if (!coincide) {
    registrarFallo(clave);
    throw credencialesInvalidas;
  }

  // Acertó la contraseña: el contador se limpia acá y no después del chequeo de
  // `activo`. Lo que se frena es adivinar contraseñas, y esta ya no se adivinó.
  limpiarIntentos(clave);

  if (!usuario.activo) {
    throw new AppError(403, 'La cuenta está desactivada. Contactá al administrador.');
  }

  delete usuario.password_hash;
  res.json({ token: firmarToken(usuario), usuario, zona_horaria: config.zonaHoraria });
});

/**
 * GET /api/auth/me → datos del usuario logueado (para rehidratar el frontend).
 *
 * Viaja también la zona del club. El frontend formatea las fechas ahí y no en la
 * del dispositivo: si no, un vendedor con el teléfono en otra zona vería un día
 * distinto del que lleva impreso el comprobante. Va con el usuario, y no en un
 * endpoint aparte, porque es lo primero que la app pide al abrirse.
 */
router.get('/me', requireAuth, (req, res) => {
  res.json({ usuario: req.user, zona_horaria: config.zonaHoraria });
});

/**
 * POST /api/auth/usuarios → alta de vendedor o admin. Solo admin.
 * No hay registro público: las cuentas las crea el administrador.
 */
router.post('/usuarios', requireAuth, requireAdmin, async (req, res) => {
  const { nombre, usuario, password, rol = 'vendedor' } = req.body ?? {};

  if (!nombre?.trim() || !usuario?.trim() || !password) {
    throw new AppError(400, 'Nombre, usuario y contraseña son obligatorios.');
  }

  const nombreUsuario = normalizarUsuario(usuario);
  if (!FORMATO_USUARIO.test(nombreUsuario)) {
    throw new AppError(400, FORMATO_INVALIDO);
  }

  if (password.length < 8) {
    throw new AppError(400, 'La contraseña debe tener al menos 8 caracteres.');
  }
  if (!['vendedor', 'admin'].includes(rol)) {
    throw new AppError(400, 'El rol debe ser "vendedor" o "admin".');
  }

  const hash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    `INSERT INTO usuarios (nombre, usuario, password_hash, rol)
     VALUES ($1, $2, $3, $4)
     RETURNING id, nombre, usuario, rol, activo, created_at`,
    [nombre.trim(), nombreUsuario, hash, rol],
  );

  res.status(201).json({ usuario: rows[0] });
});

/** GET /api/auth/usuarios → listado de usuarios. Solo admin. */
router.get('/usuarios', requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await query(
    `SELECT id, nombre, usuario, rol, activo, created_at
     FROM usuarios ORDER BY rol, nombre`,
  );
  res.json({ usuarios: rows });
});

/**
 * PATCH /api/auth/usuarios/:id → corrige los datos de una cuenta. Solo admin.
 *
 * La contraseña no se toca acá: tiene su propia ruta, porque cambiarla tiene
 * un efecto que los demás campos no tienen (cierra las sesiones abiertas).
 */
router.patch('/usuarios/:id', requireAuth, requireAdmin, async (req, res) => {
  const { nombre, usuario, rol } = req.body ?? {};
  const id = Number(req.params.id);

  if (!nombre?.trim() || !usuario?.trim()) {
    throw new AppError(400, 'Nombre y usuario son obligatorios.');
  }

  const nombreUsuario = normalizarUsuario(usuario);
  if (!FORMATO_USUARIO.test(nombreUsuario)) {
    throw new AppError(400, FORMATO_INVALIDO);
  }
  if (!['vendedor', 'admin'].includes(rol)) {
    throw new AppError(400, 'El rol debe ser "vendedor" o "admin".');
  }

  // Sacarse el rol de admin a uno mismo deja el panel sin nadie que lo maneje
  // si es el único admin, y en cualquier caso es un error de dedo, no una
  // intención.
  if (id === req.user.id && rol !== 'admin') {
    throw new AppError(400, 'No podés sacarte a vos mismo el rol de administrador.');
  }

  const { rows } = await query(
    `UPDATE usuarios SET nombre = $1, usuario = $2, rol = $3
     WHERE id = $4
     RETURNING id, nombre, usuario, rol, activo, created_at`,
    [nombre.trim(), nombreUsuario, rol, id],
  );
  if (!rows[0]) throw new AppError(404, 'No existe ese usuario.');

  res.json({ usuario: rows[0] });
});

/**
 * PATCH /api/auth/usuarios/:id/password → le pone una contraseña nueva. Solo admin.
 *
 * No pide la contraseña anterior porque el admin no la tiene: en la base solo
 * queda el hash. Esto es para cuando un vendedor se la olvida.
 */
router.patch('/usuarios/:id/password', requireAuth, requireAdmin, async (req, res) => {
  const { password } = req.body ?? {};

  if (!password || password.length < 8) {
    throw new AppError(400, 'La contraseña debe tener al menos 8 caracteres.');
  }

  const hash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    `UPDATE usuarios SET password_hash = $1, password_actualizada_at = now()
     WHERE id = $2
     RETURNING id, nombre, usuario`,
    [hash, Number(req.params.id)],
  );
  if (!rows[0]) throw new AppError(404, 'No existe ese usuario.');

  res.json({ usuario: rows[0] });
});

/**
 * DELETE /api/auth/usuarios/:id → borra la cuenta. Solo admin.
 *
 * Solo se puede borrar una cuenta que no dejó rastro. Si cargó, anuló o
 * corrigió jugadas, borrarla se llevaría puesto el historial (o lo dejaría
 * huérfano), así que se rechaza y se ofrece desactivarla: una cuenta
 * desactivada no puede entrar, y sus jugadas siguen figurando a su nombre.
 */
router.delete('/usuarios/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);

  if (id === req.user.id) {
    throw new AppError(400, 'No podés borrar tu propia cuenta.');
  }

  const { rows: existe } = await query('SELECT nombre FROM usuarios WHERE id = $1', [id]);
  if (!existe[0]) throw new AppError(404, 'No existe ese usuario.');

  const { rows: uso } = await query(
    // Los eventos cuentan como "tocó algo" por dos motivos: son historial que se
    // perdería, y además la FK de jugadas_eventos impediría el DELETE igual.
    // Mejor un 409 que explica que un error de clave foránea.
    `SELECT
       (SELECT COUNT(*) FROM jugadas WHERE vendedor_id = $1)::int AS cargadas,
       (SELECT COUNT(*) FROM jugadas WHERE anulada_por = $1 OR editada_por = $1)::int
       + (SELECT COUNT(*) FROM jugadas_eventos WHERE usuario_id = $1)::int AS tocadas`,
    [id],
  );
  const { cargadas, tocadas } = uso[0];

  if (cargadas > 0 || tocadas > 0) {
    const detalle =
      cargadas > 0
        ? `tiene ${cargadas} jugada${cargadas === 1 ? '' : 's'} cargada${cargadas === 1 ? '' : 's'}`
        : 'anuló o corrigió jugadas';
    throw new AppError(
      409,
      `No se puede borrar a ${existe[0].nombre}: ${detalle} y se perdería el historial. ` +
        'Desactivá la cuenta: no va a poder entrar y las jugadas siguen a su nombre.',
    );
  }

  await query('DELETE FROM usuarios WHERE id = $1', [id]);
  res.json({ borrado: existe[0].nombre });
});

/** PATCH /api/auth/usuarios/:id/activo → activar o desactivar. Solo admin. */
router.patch('/usuarios/:id/activo', requireAuth, requireAdmin, async (req, res) => {
  const { activo } = req.body ?? {};
  if (typeof activo !== 'boolean') {
    throw new AppError(400, 'El campo "activo" debe ser true o false.');
  }

  const id = Number(req.params.id);
  if (id === req.user.id) {
    throw new AppError(400, 'No podés desactivar tu propia cuenta.');
  }

  const { rows } = await query(
    `UPDATE usuarios SET activo = $1 WHERE id = $2
     RETURNING id, nombre, usuario, rol, activo`,
    [activo, id],
  );
  if (!rows[0]) throw new AppError(404, 'No existe ese usuario.');

  res.json({ usuario: rows[0] });
});

export default router;
