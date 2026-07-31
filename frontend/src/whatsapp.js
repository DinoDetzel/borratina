import { comprobanteAImagen } from './comprobanteImagen.js';
import { pesos } from './utilidades.js';

/**
 * Enviar el comprobante por WhatsApp, de dos maneras.
 *
 * **La foto** (`compartirComprobante`) es lo que se manda casi siempre: el
 * comprador recibe el ticket como lo vería en papel. WhatsApp no acepta
 * adjuntos por URL, así que va por el selector del sistema y el contacto lo
 * elige el vendedor.
 *
 * **El texto** (`enlaceWhatsapp`) queda como segunda opción y no es un plan B
 * pobre: abre el chat del comprador directamente y deja el número de
 * comprobante como texto, que se puede copiar y —sobre todo— encontrar
 * buscando en el chat dentro de un mes, cuando venga a cobrar. Adentro de una
 * imagen, ese número no se busca.
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
 *
 * Este camino manda **texto**: `wa.me` no acepta adjuntos. Para mandar la foto
 * del comprobante está `compartirComprobante()`.
 */
export function enlaceWhatsapp(comprobante) {
  const numero = numeroWhatsapp(comprobante.comprador.telefono);
  const texto = encodeURIComponent(mensajeComprobante(comprobante));
  return `https://wa.me/${numero ?? ''}?text=${texto}`;
}

/** Un pie corto para acompañar la imagen, cuando la app de destino lo acepta. */
const pieDeFoto = ({ codigo, comprador }) =>
  `Comprobante ${codigo} — ${comprador.nombre}. Guardalo para reclamar el premio.`;

/**
 * Manda la **foto** del comprobante por donde el teléfono ofrezca compartir.
 *
 * WhatsApp no recibe adjuntos por URL, así que la única vía es el selector del
 * sistema (Web Share API con archivos): se abre la lista de apps, se elige
 * WhatsApp y el contacto, y la imagen va adjunta. A cambio de eso se pierde
 * poder abrir el chat del comprador directamente, que es lo que sí hace el
 * botón de texto.
 *
 * Devuelve qué pasó, para que la pantalla pueda decirlo:
 *   'compartido'  el selector se abrió y la persona eligió a dónde mandarla
 *   'cancelado'   lo cerró sin elegir
 *   'descargado'  el navegador no comparte archivos: se bajó el PNG
 */
export async function compartirComprobante(comprobante) {
  const imagen = await comprobanteAImagen(comprobante);
  const archivo = new File([imagen], `comprobante-${comprobante.codigo}.png`, {
    type: 'image/png',
  });

  // `canShare` con el archivo adelante: hay navegadores que tienen `share` pero
  // no aceptan adjuntos, y preguntar por `share` a secas los deja fallando en
  // el momento de compartir.
  if (navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], text: pieDeFoto(comprobante) });
      return 'compartido';
    } catch (err) {
      // Cerrar el selector no es un error que haya que mostrar.
      if (err.name === 'AbortError') return 'cancelado';
      throw err;
    }
  }

  // En la computadora, o en un navegador sin compartir: se descarga y se
  // adjunta a mano. Es un paso más, pero el comprobante igual sale.
  const url = URL.createObjectURL(imagen);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = archivo.name;
  enlace.click();
  URL.revokeObjectURL(url);
  return 'descargado';
}
