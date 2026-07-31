import { useEffect, useRef } from 'react';

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

/**
 * Cartel modal: confirmar algo que no se puede deshacer, o completar un
 * formulario corto sin salir de la pantalla.
 *
 * Usa el <dialog> nativo con showModal(), que ya se encarga del foco, del fondo
 * inerte y de cerrar con Escape. El contenido va dentro de un <form>, así Enter
 * confirma sin tener que llegar al botón.
 */
export function Dialogo({
  titulo,
  children,
  confirmar = 'Confirmar',
  peligro = false,
  ocupado = false,
  onConfirmar,
  onCerrar,
}) {
  const ref = useRef(null);

  useEffect(() => {
    // showModal() no se puede llamar dos veces sobre el mismo diálogo abierto.
    if (!ref.current?.open) ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className={`dialogo ${peligro ? 'peligroso' : ''}`}
      // Escape y el click en el fondo disparan "cancel": lo tomamos nosotros
      // para que el estado de React quede en sincronía con el DOM.
      onCancel={(e) => {
        e.preventDefault();
        onCerrar();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onConfirmar();
        }}
      >
        <h2>{titulo}</h2>
        <div className="cuerpo">{children}</div>

        <div className="acciones">
          <button type="button" className="secundario" onClick={onCerrar} disabled={ocupado}>
            Cancelar
          </button>
          <button type="submit" className={peligro ? 'peligro lleno' : ''} disabled={ocupado}>
            {ocupado ? 'Un momento…' : confirmar}
          </button>
        </div>
      </form>
    </dialog>
  );
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
