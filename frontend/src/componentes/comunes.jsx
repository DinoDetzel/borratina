import { formatearNumero } from '../utilidades.js';

/**
 * Números a dos dígitos: los 4 de una jugada, o los 20 de un extracto.
 *
 * Una jugada se muestra siempre en una línea; un extracto necesita envolver.
 * Se decide por la cantidad y no por una prop, para que quien lo use no tenga
 * que acordarse.
 */
export function Bolillas({ numeros }) {
  if (!numeros?.length) return null;

  return (
    <span className={`bolillas ${numeros.length > 4 ? 'envuelve' : ''}`}>
      {numeros.map((n, i) => (
        <span className="bolilla" key={i}>
          {formatearNumero(n)}
        </span>
      ))}
    </span>
  );
}

/**
 * Estado de un sorteo o de una jugada.
 * El color va siempre con la palabra al lado: nunca identifica por sí solo.
 */
export function Chip({ estado, children }) {
  return <span className={`chip ${estado}`}>{children ?? estado}</span>;
}

export function MensajeError({ children }) {
  return children ? <div className="error">{children}</div> : null;
}

export function MensajeExito({ children }) {
  return children ? <div className="exito">{children}</div> : null;
}

export function Cargando({ children = 'Cargando…' }) {
  return <div className="vacio">{children}</div>;
}

export function Vacio({ children }) {
  return <div className="vacio">{children}</div>;
}

/** Dato suelto: etiqueta arriba, número grande abajo. */
export function Ficha({ etiqueta, valor, pie }) {
  return (
    <div className="tarjeta ficha">
      <div className="etiqueta">{etiqueta}</div>
      <div className="valor">{valor}</div>
      {pie && <div className="pie">{pie}</div>}
    </div>
  );
}
