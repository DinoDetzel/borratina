import { AppError } from '../middleware/errors.js';

export const CANTIDAD_NUMEROS = 4;
const MIN = 0;
const MAX = 99;

/**
 * Como el orden de los números no importa (ver memories/reglas-de-negocio.md),
 * los guardamos siempre ordenados ascendentemente. Eso convierte el match
 * "mismo conjunto de números" en una comparación posicional que sigue usando
 * el índice compuesto de jugadas.
 */
export const normalizar = (numeros) => [...numeros].sort((a, b) => a - b);

/**
 * Valida que venga un array de 4 enteros entre 0 y 99 y lo devuelve normalizado.
 * Es el único punto por el que deben pasar los números antes de tocar la base.
 *
 * Nota: hoy se permiten números repetidos dentro de una misma jugada
 * (ej: 07 07 23 45). Está marcado como punto abierto en las reglas de negocio;
 * si se confirma que deben ser distintos, la validación va acá.
 */
export function validarNumeros(numeros, campo = 'numeros') {
  if (!Array.isArray(numeros) || numeros.length !== CANTIDAD_NUMEROS) {
    throw new AppError(400, `"${campo}" debe ser un array de ${CANTIDAD_NUMEROS} números.`);
  }

  const enteros = numeros.map((n) => {
    // Rechazamos "07abc" y similares: solo aceptamos algo que sea un entero limpio.
    const valor = typeof n === 'string' && /^\d{1,2}$/.test(n.trim()) ? Number(n) : n;

    if (!Number.isInteger(valor) || valor < MIN || valor > MAX) {
      throw new AppError(400, `Cada número de "${campo}" debe ser un entero entre ${MIN} y ${MAX}.`);
    }
    return valor;
  });

  return normalizar(enteros);
}

/** Formatea para mostrar: 7 → "07". */
export const formatear = (n) => String(n).padStart(2, '0');
