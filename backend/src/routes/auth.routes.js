import { Router } from 'express';
import bcrypt from 'bcryptjs';

import { query } from '../db.js';
import { AppError } from '../middleware/errors.js';
import { firmarToken, requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

/** POST /api/auth/login → { token, usuario } */
router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    throw new AppError(400, 'Email y contraseña son obligatorios.');
  }

  const { rows } = await query(
    'SELECT id, nombre, email, rol, activo, password_hash FROM usuarios WHERE email = $1',
    [String(email).trim().toLowerCase()],
  );
  const usuario = rows[0];

  // Mismo mensaje para usuario inexistente y contraseña incorrecta: no le
  // regalamos a nadie la información de qué emails están registrados.
  const credencialesInvalidas = new AppError(401, 'Email o contraseña incorrectos.');

  if (!usuario) {
    // Hasheamos igual para que el tiempo de respuesta no delate si el email existe.
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
  const { nombre, email, password, rol = 'vendedor' } = req.body ?? {};

  if (!nombre?.trim() || !email?.trim() || !password) {
    throw new AppError(400, 'Nombre, email y contraseña son obligatorios.');
  }
  if (password.length < 8) {
    throw new AppError(400, 'La contraseña debe tener al menos 8 caracteres.');
  }
  if (!['vendedor', 'admin'].includes(rol)) {
    throw new AppError(400, 'El rol debe ser "vendedor" o "admin".');
  }

  const hash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    `INSERT INTO usuarios (nombre, email, password_hash, rol)
     VALUES ($1, $2, $3, $4)
     RETURNING id, nombre, email, rol, activo, created_at`,
    [nombre.trim(), email.trim().toLowerCase(), hash, rol],
  );

  res.status(201).json({ usuario: rows[0] });
});

/** GET /api/auth/usuarios → listado de usuarios. Solo admin. */
router.get('/usuarios', requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await query(
    `SELECT id, nombre, email, rol, activo, created_at
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
     RETURNING id, nombre, email, rol, activo`,
    [activo, id],
  );
  if (!rows[0]) throw new AppError(404, 'No existe ese usuario.');

  res.json({ usuario: rows[0] });
});

export default router;
