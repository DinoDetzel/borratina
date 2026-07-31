import { pesos } from './utilidades.js';

/**
 * Enviar el comprobante por WhatsApp.
 *
 * Va como texto y no como imagen a propósito. Una foto del ticket se ve linda
 * pero el número de comprobante queda adentro de un mapa de píxeles: el
 * comprador no lo puede copiar ni encontrar buscando en el chat, que es
 * justamente lo que va a hacer dentro de un mes cuando venga a cobrar. Además
 * evita cargar una librería de captura de 200 kB en una app que se usa con datos
 * móviles.
 */

/**
 * Pasa un teléfono tipeado a mano al formato que espera wa.me: solo dígitos,
 * con código de país y el 9 de celular argentino.
 *
 *   "351-4567890"      → 5493514567890
 *   "351 15 4567890"   → 5493514567890
 *   "+54 9 351 4567890"→ 5493514567890
 *
 * Devuelve null cuando el número no cierra. **No adivina**: es preferible que el
 * vendedor elija el contacto a mano antes que abrir el chat de otra persona con
 * los datos de una jugada ajena.
 */
export function numeroWhatsapp(telefono) {
  let d = String(telefono ?? '').replace(/\D/g, '');
  if (!d) return null;

  d = d.replace(/^00/, '');
  if (d.startsWith('54')) d = d.slice(2);
  if (d.startsWith('9')) d = d.slice(1);
  d = d.replace(/^0/, '');

  // El "15" es el prefijo con el que se marca un celular dentro del país y
  // sobra al llamar desde afuera. Se saca solo si al sacarlo el número queda
  // con los 10 dígitos que tiene un celular argentino (área + abonado): así no
  // se le arruina un número que casualmente tenga un 15 en el medio.
  if (d.length === 12) {
    for (const i of [2, 3, 4]) {
      if (d.slice(i, i + 2) === '15') {
        d = d.slice(0, i) + d.slice(i + 2);
        break;
      }
    }
  }

  return d.length === 10 ? `549${d}` : null;
}

/** El texto del comprobante. WhatsApp entiende *negrita* con asteriscos. */
export function mensajeComprobante({ codigo, numeros, comprador, sorteo, importe }) {
  const fecha = sorteo.sortea_el
    ? new Date(sorteo.sortea_el).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : null;

  return [
    '*al Rojo Vivo!!!* — Club Deportivo Sarmiento',
    '',
    `A nombre de: ${comprador.nombre}`,
    `Números: *${numeros.join('  ')}*`,
    `N° de comprobante: *${codigo}*`,
    '',
    `Pozo: *${pesos(sorteo.pozo)}*`,
    fecha && `Sortea el ${fecha} por la Quiniela de la Ciudad Nocturna.`,
    `Valor de la jugada: ${pesos(importe)}`,
    '',
    'Ganás si tus 4 números salen entre los 20 primeros premios de esa quiniela.',
    'Guardá este mensaje: el número de comprobante es lo que hay que presentar para cobrar.',
  ]
    .filter((linea) => linea !== null)
    .join('\n');
}

/**
 * El enlace que abre WhatsApp con el mensaje escrito.
 *
 * Con el teléfono del comprador abre su chat directo; sin él, WhatsApp pide
 * elegir el contacto. En los dos casos el mensaje queda listo y el envío lo
 * confirma la persona: nunca se manda solo.
 */
export function enlaceWhatsapp(comprobante) {
  const numero = numeroWhatsapp(comprobante.comprador.telefono);
  const texto = encodeURIComponent(mensajeComprobante(comprobante));
  return `https://wa.me/${numero ?? ''}?text=${texto}`;
}
