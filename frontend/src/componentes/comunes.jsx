import { formatearNumero } from '../utilidades.js';

/** Los 4 números de una jugada, siempre a dos dígitos. */
export function Bolillas({ numeros }) {
  return (
    <span className="bolillas">
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
