import { AppError } from '../middleware/errors.js';
import { formatear } from './numeros.js';

/**
 * Alfabeto de los códigos, igual al de generar_codigo_jugada() en la migración 002.
 * No incluye 0, 1, I, L, O ni U: son los caracteres que se confunden entre sí al
 * leerlos de un papel o dictarlos por teléfono.
 */
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Lleva un código tipeado por una persona a la forma canónica `XXXX-XXXX`.
 *
 * Se acepta con o sin guion, en minúsculas y con espacios de más, porque el
 * código se dicta por teléfono o se copia de un papel.
 *
 * No se intenta "corregir" letras confundidas: como el alfabeto ya excluye los
 * pares ambiguos, un carácter fuera de él no tiene a qué mapearse. Se avisa cuál
 * es el carácter problemático, que le sirve más a quien está tipeando que un
 * "no encontrado" a secas.
 */
export function normalizarCodigo(codigo) {
  const limpio = String(codigo ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  if (limpio.length !== 8) {
    throw new AppError(400, 'El código de comprobante debe tener 8 caracteres (formato XXXX-XXXX).');
  }

  const invalidos = [...new Set([...limpio].filter((c) => !ALFABETO.includes(c)))];
  if (invalidos.length > 0) {
    throw new AppError(
      400,
      `El código no puede contener ${invalidos.join(', ')}. ` +
        'Revisá el comprobante: no usamos 0, 1, I, L, O ni U para no confundirlos con otros caracteres.',
    );
  }

  return `${limpio.slice(0, 4)}-${limpio.slice(4)}`;
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
    },
    importe: sorteo.precio_jugada,
    vendedor: jugada.vendedor ?? null,
    fecha: jugada.created_at,
    anulada: jugada.anulada,
  };
}
