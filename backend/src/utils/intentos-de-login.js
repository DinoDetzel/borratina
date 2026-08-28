import { AppError } from '../middleware/errors.js';

/**
 * Freno de fuerza bruta para el login.
 *
 * Sin esto, lo único que separa a alguien de la contraseña de un vendedor es lo
 * que tarda bcrypt —unos 70 ms, o sea del orden de mil intentos por minuto—. Las
 * contraseñas las pone el admin a mano y el mínimo son ocho caracteres, así que
 * en la práctica son cortas y memorizables. Del otro lado hay los datos de
 * contacto de los compradores y, con una cuenta de admin, anular una jugada
 * ganadora: una operación que después del sorteo **no se puede deshacer**.
 *
 * ## Por qué se cuenta por usuario y no por IP
 *
 * - Los vendedores cargan desde el club o desde datos móviles, así que comparten
 *   IP seguido. Contando por IP, un solo atacante los deja a todos afuera en
 *   pleno horario de venta: el mismo desastre que se evita no rotando el
 *   `JWT_SECRET` un martes a las 21.
 * - Detrás del proxy de Render, `req.ip` es el del proxy salvo que se configure
 *   `trust proxy`. Mal puesto, el bloqueo nace siendo global.
 * - Lo que hay que frenar es que prueben contraseñas contra una cuenta concreta,
 *   y eso no se esquiva cambiando de IP.
 *
 * **Lo que no cubre:** probar una misma contraseña contra muchas cuentas. Sin
 * registro público y con pocos vendedores, eso exige conocer los nombres de
 * usuario primero. Si alguna vez hace falta, el segundo freno va por IP y ahí sí
 * hay que configurar `trust proxy` antes.
 *
 * El conteo vive en memoria: Render corre una sola instancia y la reinicia al
 * redeployar. Se pierde en cada deploy, y está bien que se pierda.
 */

/** Cuántas contraseñas erradas seguidas se toleran antes de frenar. */
export const MAX_FALLOS = 10;

/** Cuánto queda frenada la cuenta desde el último intento fallido. */
export const ESPERA_MS = 15 * 60 * 1000;

/**
 * Tope de cuentas vigiladas a la vez. Existe solo para que nadie haga crecer el
 * Map sin límite mandando usuarios inventados: al llegar acá se barren las
 * entradas ya vencidas, que es de donde sale el lugar.
 */
const MAX_VIGILADAS = 5_000;

/** usuario normalizado → { cantidad, ultimo } */
const fallos = new Map();

/** Saca las entradas cuya ventana ya venció: no dicen nada y ocupan lugar. */
function barrerVencidas(ahora) {
  for (const [usuario, registro] of fallos) {
    if (ahora - registro.ultimo > ESPERA_MS) fallos.delete(usuario);
  }
}

/**
 * Corta el login si la cuenta viene de demasiadas contraseñas erradas.
 *
 * Va **antes** de tocar la base y antes de bcrypt: así un intento frenado no
 * cuesta nada. Que la respuesta sea más rápida solo delata que esa cuenta está
 * frenada, no si existe.
 *
 * El reloj entra por parámetro para poder probar el vencimiento sin esperar
 * quince minutos.
 */
export function verificarIntentos(usuario, ahora = Date.now()) {
  const registro = fallos.get(usuario);
  if (!registro) return;

  if (ahora - registro.ultimo > ESPERA_MS) {
    fallos.delete(usuario);
    return;
  }

  if (registro.cantidad < MAX_FALLOS) return;

  // Los minutos van en el mensaje: al vendedor que se equivocó de tecla le sirve
  // saber cuánto esperar, y a quien esté probando contraseñas no le dice nada
  // que no sepa ya.
  const minutos = Math.ceil((registro.ultimo + ESPERA_MS - ahora) / 60_000);
  throw new AppError(
    429,
    `Demasiados intentos fallidos con esa cuenta. Probá de nuevo en ${minutos} ` +
      `${minutos === 1 ? 'minuto' : 'minutos'}, o pedile al administrador una contraseña nueva.`,
  );
}

/** Suma un intento fallido. La ventana se cuenta desde el último. */
export function registrarFallo(usuario, ahora = Date.now()) {
  if (fallos.size >= MAX_VIGILADAS) barrerVencidas(ahora);

  const registro = fallos.get(usuario);
  const vencido = registro && ahora - registro.ultimo > ESPERA_MS;

  fallos.set(usuario, {
    cantidad: registro && !vencido ? registro.cantidad + 1 : 1,
    ultimo: ahora,
  });
}

/** Acertó la contraseña: se borra lo que hubiera contado. */
export function limpiarIntentos(usuario) {
  fallos.delete(usuario);
}
