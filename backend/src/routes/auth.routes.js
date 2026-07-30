import { Router } from 'express';
import bcrypt from 'bcryptjs';

import { query } from '../db.js';
import { AppError } from '../middleware/errors.js';
import { firmarToken, requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

/**
 * Deja el nombre de usuario en su forma canónica: minúsculas y sin espacios
 * alrededor. Se aplica tanto al crear la cuenta como al buscarla, así que
 * "Dino" y "dino " entran igual.
 */
const normalizarUsuario = (valor) => String(valor ?? '').trim().toLowerCase();

const FORMATO_USUARIO = /^[a-z0-9._-]{3,30}$/;

/** POST /api/auth/login → { token, usuario } */
router.post('/login', async (req, res) => {
  const { usuario: nombreUsuario, password } = req.body ?? {};

  if (!nombreUsuario || !password) {
    throw new AppError(400, 'Usuario y contraseña son obligatorios.');
  }

  const { rows } = await query(
    `SELECT id, nombre, usuario, email, rol, activo, password_hash
     FROM usuarios WHERE usuario = $1`,
    [normalizarUsuario(nombreUsuario)],
  );
  const usuario = rows[0];

  // Mismo mensaje para cuenta inexistente y contraseña incorrecta: no le
  // regalamos a nadie la información de qué usuarios están registrados.
  const credencialesInvalidas = new AppError(401, 'Usuario o contraseña incorrectos.');

  if (!usuario) {
    // Hasheamos igual para que el tiempo de respuesta no delate si existe.
    await bcrypt.compare(password, '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva');
    throw credencialesInvalidas;
  }

  const coincide = await bcrypt.compare(password, usuario.password_hash);
  if (!coincide) throw credencialesInvalidas;

  if (!usuario.activo) {
    throw new AppError(403, 'La cuenta está desactivada. Contactá al administrador.');
  }

  delete usuario.password_hash;
  res.json({ token: firmarToken(usuario), usuario });
});

/** GET /api/auth/me → datos del usuario logueado (para rehidratar el frontend). */
router.get('/me', requireAuth, (req, res) => {
  res.json({ usuario: req.user });
});

/**
 * POST /api/auth/usuarios → alta de vendedor o admin. Solo admin.
 * No hay registro público: las cuentas las crea el administrador.
 */
router.post('/usuarios', requireAuth, requireAdmin, async (req, res) => {
  const { nombre, usuario, email, password, rol = 'vendedor' } = req.body ?? {};

  if (!nombre?.trim() || !usuario?.trim() || !password) {
    throw new AppError(400, 'Nombre, usuario y contraseña son obligatorios.');
  }

  const nombreUsuario = normalizarUsuario(usuario);
  if (!FORMATO_USUARIO.test(nombreUsuario)) {
    throw new AppError(
      400,
      'El usuario debe tener entre 3 y 30 caracteres, y solo puede llevar letras, ' +
        'números, punto, guion o guion bajo (sin espacios ni acentos).',
    );
  }

  if (password.length < 8) {
    throw new AppError(400, 'La contraseña debe tener al menos 8 caracteres.');
  }
  if (!['vendedor', 'admin'].includes(rol)) {
    throw new AppError(400, 'El rol debe ser "vendedor" o "admin".');
  }

  // El email es opcional: sirve de contacto, no para entrar.
  const correo = email?.trim() ? email.trim().toLowerCase() : null;

  const hash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    `INSERT INTO usuarios (nombre, usuario, email, password_hash, rol)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, nombre, usuario, email, rol, activo, created_at`,
    [nombre.trim(), nombreUsuario, correo, hash, rol],
  );

  res.status(201).json({ usuario: rows[0] });
});

/** GET /api/auth/usuarios → listado de usuarios. Solo admin. */
router.get('/usuarios', requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await query(
    `SELECT id, nombre, usuario, email, rol, activo, created_at
     FROM usuarios ORDER BY rol, nombre`,
  );
  res.json({ usuarios: rows });
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
     RETURNING id, nombre, usuario, email, rol, activo`,
    [activo, id],
  );
  if (!rows[0]) throw new AppError(404, 'No existe ese usuario.');

  res.json({ usuario: rows[0] });
});

export default router;
