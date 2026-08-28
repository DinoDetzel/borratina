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
 * Convierte a Date lo que manda la API, sin que se corra el día.
 *
 * Una fecha **sin hora** ('AAAA-MM-DD') el navegador la parsea como medianoche
 * UTC, y al formatearla en la zona local cae en el día anterior en cualquier
 * lugar al oeste de Greenwich: acá, '2026-08-15' se mostraba como 14/08.
 *
 * Eso es justo lo que el backend evita mandando el día del gráfico como texto y
 * no como fecha (ver `/dashboard/ventas`), así que el cuidado se perdía en la
 * última línea. Completarla con la hora la ancla al día local, que es el día que
 * el vendedor cargó.
 *
 * Los timestamps completos llevan zona adentro y no necesitan nada: se pasan tal
 * cual.
 */
const soloFecha = /^\d{4}-\d{2}-\d{2}$/;
const aFecha = (iso) => new Date(soloFecha.test(iso) ? `${iso}T00:00` : iso);

export function fechaHora(iso) {
  if (!iso) return '—';
  return aFecha(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Solo el día: cuando la hora exacta no le importa a nadie. */
export function fechaDia(iso) {
  if (!iso) return '—';
  return aFecha(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function fechaCorta(iso) {
  if (!iso) return '—';
  return aFecha(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
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
