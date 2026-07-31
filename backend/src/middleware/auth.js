import jwt from 'jsonwebtoken';

import { config } from '../config.js';
import { AppError } from './errors.js';
import { query } from '../db.js';

/**
 * Verifica el JWT del header Authorization y deja el usuario en req.user.
 *
 * Revalidamos contra la base en cada request (no alcanza con confiar en el
 * payload del token): así un usuario dado de baja o al que le cambiaron el rol
 * deja de tener acceso sin esperar a que le expire el token.
 */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [esquema, token] = header.split(' ');

  if (esquema !== 'Bearer' || !token) {
    return next(new AppError(401, 'Falta el token de autenticación.'));
  }

  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret);
  } catch (err) {
    const mensaje =
      err.name === 'TokenExpiredError'
        ? 'La sesión expiró, volvé a iniciar sesión.'
        : 'Token de autenticación inválido.';
    return next(new AppError(401, mensaje));
  }

  const { rows } = await query(
    `SELECT id, nombre, usuario, email, rol, activo, password_actualizada_at
     FROM usuarios WHERE id = $1`,
    [payload.sub],
  );
  const usuario = rows[0];

  if (!usuario || !usuario.activo) {
    return next(new AppError(401, 'La cuenta no existe o está desactivada.'));
  }

  // Si la contraseña cambió después de que se firmó este token, el token no
  // vale más: es lo que hace que restablecer una clave eche de verdad al que
  // la tenía. `iat` viene en segundos, así que la fecha del cambio se trunca a
  // segundos también; si no, un login en el mismo segundo que el cambio se
  // rechazaría a sí mismo.
  const cambioEnSegundos = Math.floor(new Date(usuario.password_actualizada_at).getTime() / 1000);
  if (payload.iat < cambioEnSegundos) {
    return next(new AppError(401, 'La contraseña cambió, volvé a iniciar sesión.'));
  }

  delete usuario.password_actualizada_at;
  req.user = usuario;
  return next();
}

/**
 * Exige rol admin. Va siempre después de requireAuth.
 * El frontend esconde estas acciones, pero la validación que cuenta es esta.
 */
export function requireAdmin(req, res, next) {
  if (req.user?.rol !== 'admin') {
    return next(new AppError(403, 'Esta acción es exclusiva del administrador.'));
  }
  return next();
}

export const firmarToken = (usuario) =>
  jwt.sign({ sub: usuario.id, rol: usuario.rol }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
