/** 7 → "07". Los números de la borratina se leen siempre de dos cifras. */
export const formatearNumero = (n) => String(n).padStart(2, '0');

const PESOS = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

export const pesos = (monto) => (monto == null ? '—' : PESOS.format(monto));

export const numero = (n) => (n == null ? '—' : new Intl.NumberFormat('es-AR').format(n));

export function fechaHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fechaCorta(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
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
