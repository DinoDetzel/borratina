import { AppError } from '../middleware/errors.js';

export const CANTIDAD_NUMEROS = 4;

/** Cuántos números trae el extracto oficial de la quiniela. */
export const CANTIDAD_EXTRACTO = 20;

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
 * Los números **pueden repetirse** dentro de una misma jugada (07 07 23 45, e
 * incluso 55 55 55 55): así es el juego, no es un descuido. Repetir no es
 * gratis: para ganar, el extracto tiene que traer ese número la misma cantidad
 * de veces.
 */
export function validarNumeros(numeros, campo = 'numeros') {
  return normalizar(validarLista(numeros, CANTIDAD_NUMEROS, campo));
}

/**
 * Valida el extracto oficial: 20 números del 00 al 99, con repetidos permitidos.
 *
 * A diferencia de las jugadas, **no se normaliza el orden**: el extracto se
 * publica en un orden determinado (primer premio, segundo, …) y conviene poder
 * mostrarlo como se leyó. El orden no interviene en el match: lo que importa es
 * qué números salieron y cuántas veces.
 */
export function validarExtracto(numeros, campo = 'numeros') {
  return validarLista(numeros, CANTIDAD_EXTRACTO, campo);
}

/** Chequea que sea un array de `cantidad` enteros entre 0 y 99. */
function validarLista(numeros, cantidad, campo) {
  if (!Array.isArray(numeros) || numeros.length !== cantidad) {
    throw new AppError(400, `"${campo}" debe ser un array de ${cantidad} números.`);
  }

  return numeros.map((n) => {
    // Rechazamos "07abc" y similares: solo aceptamos algo que sea un entero limpio.
    const valor = typeof n === 'string' && /^\d{1,2}$/.test(n.trim()) ? Number(n) : n;

    if (!Number.isInteger(valor) || valor < MIN || valor > MAX) {
      throw new AppError(400, `Cada número de "${campo}" debe ser un entero entre ${MIN} y ${MAX}.`);
    }
    return valor;
  });
}

/** Formatea para mostrar: 7 → "07". */
export const formatear = (n) => String(n).padStart(2, '0');
