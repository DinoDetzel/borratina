import { useRef, useState } from 'react';

import { api } from '../api.js';
import { compartirComprobante } from '../whatsapp.js';

/** Lo que hay que contarle al vendedor cuando el envío no terminó en WhatsApp. */
const AVISOS = {
  descargado:
    'Este navegador no comparte archivos, así que el comprobante se descargó. ' +
    'Adjuntalo desde WhatsApp.',
  'sin-permiso': 'No llegó a abrirse la lista de apps. Tocá de nuevo: ahora sale derecho.',
};

/**
 * Manda el comprobante de una jugada, esté a la vista o no.
 *
 * Dos formas de usarlo, según de dónde salga la jugada:
 *   comprobante={...}  el que se acaba de emitir, ya armado en pantalla
 *   codigo="..."       una de la lista: se le pide al servidor al tocarlo
 *
 * El código y no la fila entera porque la lista no trae los datos del sorteo
 * —pozo, fecha, precio— y son parte del comprobante. Armarlo acá con el sorteo
 * que está en pantalla saldría mal justo en el caso que importa: una jugada del
 * mes pasado llevaría impreso el pozo de este mes.
 *
 * `onAviso(texto, esError)` recibe qué contar —null cuando salió todo bien— y
 * dónde ponerlo lo decide cada pantalla, que es la que sabe dónde hay lugar.
 * Que se haya descargado en vez de compartirse no es un error: en la computadora
 * pasa siempre, y en la pantalla del admin es el camino normal.
 */
export default function BotonCompartir({
  comprobante,
  codigo,
  className,
  children = 'Enviar comprobante',
  onAviso,
}) {
  const [ocupado, setOcupado] = useState(false);

  // Lo traído queda a mano: si el primer toque se pasó de tiempo pidiéndolo, el
  // segundo tiene que abrir el selector sin volver a la red.
  const traido = useRef(null);

  async function mandar() {
    setOcupado(true);
    onAviso?.(null);
    try {
      let datos = comprobante;
      if (!datos) {
        // El código va en la comparación porque una misma fila de la tabla puede
        // quedar apuntando a otra jugada cuando la lista se recarga.
        if (traido.current?.codigo !== codigo) {
          traido.current = (await api.jugadas.porComprobante(codigo)).comprobante;
        }
        datos = traido.current;
      }

      onAviso?.(AVISOS[await compartirComprobante(datos)] ?? null, false);
    } catch (err) {
      onAviso?.(err.message || 'No se pudo preparar el comprobante. Probá de nuevo.', true);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <button type="button" className={className} onClick={mandar} disabled={ocupado}>
      {ocupado ? 'Preparando…' : children}
    </button>
  );
}
