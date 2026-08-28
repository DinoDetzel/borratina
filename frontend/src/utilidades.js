/** 7 → "07". Los números de la borratina se leen siempre de dos cifras. */
export const formatearNumero = (n) => String(n).padStart(2, '0');

/** Cuántos números elige el comprador en una jugada. */
export const CANTIDAD_NUMEROS = 4;

/** Cuántos números trae el extracto oficial de la quiniela. */
export const CANTIDAD_EXTRACTO = 20;

const PESOS = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

export const pesos = (monto) => (monto == null ? '—' : PESOS.format(monto));

export const numero = (n) => (n == null ? '—' : new Intl.NumberFormat('es-AR').format(n));

/**
 * La zona del club, que es en la que se muestra **todo** lo que sea "qué día es".
 *
 * No es la del dispositivo a propósito: un vendedor con el teléfono en otra zona
 * —de viaje, o mal configurado— vería un día distinto del que lleva impreso el
 * comprobante, y el comprobante es el papel con el que se reclama un premio.
 *
 * La manda el backend junto con el usuario (`/auth/login` y `/auth/me`), así
 * `TZ_CLUB` sigue siendo la única fuente de verdad y no hay que acordarse de
 * cambiarla en dos lados. El valor de acá es solo el que rige hasta que llega la
 * primera respuesta.
 */
let zonaClub = 'America/Argentina/Buenos_Aires';

/** La fija el contexto de auth apenas el backend contesta. */
export const fijarZonaClub = (zona) => {
  if (zona) zonaClub = zona;
};

/**
 * Separa las dos cosas distintas que manda la API, que se leen distinto.
 *
 * Un **timestamp completo** es un instante: existe una hora real y hay que
 * mirarla desde algún lado. Se lee en la zona del club.
 *
 * Una **fecha sin hora** ('AAAA-MM-DD', como el día del gráfico de ventas) no es
 * un instante: ya viene resuelta, el backend la agrupó y lo que queda es
 * mostrarla. Se lee en UTC, que acá equivale a no aplicarle ninguna zona, y así
 * el día que se muestra es exactamente el que llegó. Pasarla por la zona del
 * club la correría un día, que es el bug que tenía el eje del gráfico.
 */
const soloFecha = /^\d{4}-\d{2}-\d{2}$/;

const leer = (iso) =>
  soloFecha.test(iso)
    ? { fecha: new Date(`${iso}T00:00:00Z`), zona: 'UTC' }
    : { fecha: new Date(iso), zona: zonaClub };

export function fechaHora(iso) {
  if (!iso) return '—';
  const { fecha, zona } = leer(iso);
  return fecha.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: zona,
  });
}

/** Solo el día: cuando la hora exacta no le importa a nadie. */
export function fechaDia(iso) {
  if (!iso) return '—';
  const { fecha, zona } = leer(iso);
  return fecha.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: zona,
  });
}

export function fechaCorta(iso) {
  if (!iso) return '—';
  const { fecha, zona } = leer(iso);
  return fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', timeZone: zona });
}

/**
 * Cuáles de los números de una jugada están en el extracto, uno por uno.
 * Devuelve un booleano por número, en el mismo orden.
 *
 * Los repetidos cuentan: la segunda vez que la jugada repite un número solo
 * queda marcada si el extracto también lo trae dos veces. Es la misma regla que
 * `esGanadora()` en el backend, pero acá es solo para pintar; quién ganó lo dice
 * el campo `gano` que manda la API, que es la única fuente que vale.
 */
export function aciertos(numeros, extracto) {
  if (!extracto) return numeros.map(() => false);

  const disponibles = new Map();
  for (const n of extracto) disponibles.set(n, (disponibles.get(n) ?? 0) + 1);

  return numeros.map((n) => {
    const quedan = disponibles.get(n) ?? 0;
    if (quedan === 0) return false;
    disponibles.set(n, quedan - 1);
    return true;
  });
}

/** '2026-08' → 'agosto 2026' */
export function periodoLargo(periodo) {
  if (!periodo) return '—';
  const [anio, mes] = periodo.split('-');
  const nombre = new Date(Number(anio), Number(mes) - 1, 1).toLocaleDateString('es-AR', {
    month: 'long',
  });
  return `${nombre} ${anio}`;
}

/** El período del mes en curso, para prellenar el alta de sorteo. */
export function periodoActual() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Date → 'AAAA-MM-DDTHH:mm', que es lo único que acepta un <input datetime-local>.
 * Se usa la hora local a propósito: el admin piensa en la hora del reloj de la
 * pared, no en UTC. La conversión a UTC la hace `new Date(valor)` al enviarlo.
 */
export function paraInputFecha(fecha) {
  const d = new Date(fecha);
  const desfase = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - desfase).toISOString().slice(0, 16);
}

/** El último instante del mes de un período 'AAAA-MM', en hora local. */
export function finDelPeriodo(periodo) {
  const [anio, mes] = periodo.split('-').map(Number);
  if (!anio || !mes) return null;
  // Día 0 del mes siguiente = último día de este mes.
  return new Date(anio, mes, 0, 23, 59);
}

/** Cuánto falta hasta una fecha, en palabras: "faltan 3 días", "en 2 horas". */
export function cuantoFalta(iso) {
  const restante = new Date(iso) - Date.now();
  if (restante <= 0) return null;

  const minutos = Math.floor(restante / 60_000);
  const horas = Math.floor(minutos / 60);
  const dias = Math.floor(horas / 24);

  if (dias >= 1) return `${dias} ${dias === 1 ? 'día' : 'días'}`;
  if (horas >= 1) return `${horas} ${horas === 1 ? 'hora' : 'horas'}`;
  return `${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`;
}
