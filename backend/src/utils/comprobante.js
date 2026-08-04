import { AppError } from '../middleware/errors.js';
import { formatear } from './numeros.js';

/**
 * Alfabeto de la parte aleatoria, igual al de generar_codigo_jugada() en la
 * migración 004. No incluye 0, 1, I, L, O ni U: son los caracteres que se
 * confunden entre sí al leerlos de un papel o dictarlos por teléfono.
 */
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

const LARGO_FECHA = 6;
const LARGO_ALEATORIO = 6;
const LARGO_TOTAL = LARGO_FECHA + LARGO_ALEATORIO;

/**
 * Lleva un código tipeado por una persona a la forma canónica `AAMMDD-XXXXXX`.
 *
 *   260815-K7M3XQ  →  cargada el 15/08/2026
 *
 * Se acepta con o sin guion, en minúsculas y con espacios de más, porque el
 * código se dicta por teléfono o se copia de un papel.
 *
 * Las dos mitades se validan por separado a propósito: la fecha son seis dígitos
 * y ahí el 0 y el 1 son legítimos, mientras que la parte aleatoria nunca los
 * lleva. Validar el código entero contra el alfabeto rechazaría cualquier fecha
 * con un cero.
 */
export function normalizarCodigo(codigo) {
  const limpio = String(codigo ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  if (limpio.length !== LARGO_TOTAL) {
    throw new AppError(
      400,
      `El código de comprobante debe tener ${LARGO_TOTAL} caracteres (formato AAMMDD-XXXXXX).`,
    );
  }

  const fecha = limpio.slice(0, LARGO_FECHA);
  const aleatorio = limpio.slice(LARGO_FECHA);

  if (!/^\d{6}$/.test(fecha)) {
    throw new AppError(
      400,
      'Los primeros 6 caracteres del código son la fecha de la jugada (AAMMDD) y tienen que ser números.',
    );
  }

  // No se intenta "corregir" letras confundidas: como el alfabeto ya excluye los
  // pares ambiguos, un carácter fuera de él no tiene a qué mapearse. Se avisa
  // cuál molesta, que sirve más que un "no encontrado" a secas.
  const invalidos = [...new Set([...aleatorio].filter((c) => !ALFABETO.includes(c)))];
  if (invalidos.length > 0) {
    throw new AppError(
      400,
      `La segunda parte del código no puede contener ${invalidos.join(', ')}. ` +
        'Revisá el comprobante: ahí no usamos 0, 1, I, L, O ni U para no confundirlos con otros caracteres.',
    );
  }

  return `${fecha}-${aleatorio}`;
}

/**
 * Arma el comprobante que se le entrega al comprador.
 *
 * Devuelve datos, no HTML: el maquetado (imprimir, mandar por WhatsApp) es
 * cosa del frontend. `numeros` viene formateado a dos dígitos porque es como
 * se juega y como tiene que verse en el papel: 07, no 7.
 */
export function armarComprobante(jugada, sorteo) {
  return {
    codigo: jugada.codigo,
    numeros: [jugada.numero_1, jugada.numero_2, jugada.numero_3, jugada.numero_4].map(formatear),
    comprador: {
      nombre: jugada.comprador_nombre,
      telefono: jugada.comprador_telefono,
    },
    sorteo: {
      periodo: sorteo.periodo,
      estado: sorteo.estado,
      // El pozo se imprime en el comprobante: es el premio que el comprador
      // está comprando y tiene que quedarle por escrito.
      pozo: sorteo.pozo,
      // El día que se sortea es el día en que cierra la carga. Se manda la
      // fecha completa y el frontend imprime solo el día: la hora del cierre es
      // asunto interno y en el papel no significa nada.
      sortea_el: sorteo.finaliza_at,
    },
    importe: sorteo.precio_jugada,
    vendedor: jugada.vendedor ?? null,
    fecha: jugada.created_at,
    anulada: jugada.anulada,
  };
}
