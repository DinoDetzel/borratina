import { comprobanteAImagen } from './comprobanteImagen.js';

/**
 * Mandar el comprobante por WhatsApp: la foto del ticket, igual que en papel.
 *
 * WhatsApp no acepta adjuntos por URL, así que el único camino es el selector
 * del sistema (Web Share API con archivos). El precio es que el contacto lo
 * elige el vendedor a mano, en vez de abrirle el chat derecho al comprador.
 *
 * Hubo un segundo botón que mandaba el mismo comprobante como texto por
 * `wa.me` —eso sí abría el chat directo— pero dos botones para lo mismo
 * confundían más de lo que resolvían. Está en el historial si hace falta.
 */

/** Un pie corto para acompañar la imagen, cuando la app de destino lo acepta. */
const pieDeFoto = ({ codigo, comprador }) =>
  `Comprobante ${codigo} — ${comprador.nombre}. Guardalo para reclamar el premio.`;

/**
 * Manda la foto del comprobante por donde el teléfono ofrezca compartir.
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
