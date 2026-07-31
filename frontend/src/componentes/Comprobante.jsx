import { Bolillas, Chip } from './comunes.jsx';
import { fechaHora, periodoLargo, pesos } from '../utilidades.js';

/**
 * El comprobante que se le entrega al comprador.
 *
 * El backend manda datos, no HTML; el maquetado es de acá. Se imprime con la
 * regla @media print, que oculta todo lo demás de la página.
 */
export default function Comprobante({ comprobante, sorteado, gano, extracto }) {
  const { codigo, numeros, comprador, sorteo, importe, vendedor, fecha, anulada } = comprobante;

  return (
    <div className="comprobante">
      <div className="titulo">Comprobante de jugada</div>
      <div className="codigo-grande">{codigo}</div>

      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <Bolillas numeros={numeros} />
      </div>

      <hr className="separador" />

      <dl>
        <dt>Comprador</dt>
        <dd>{comprador.nombre}</dd>

        {comprador.telefono && (
          <>
            <dt>Teléfono</dt>
            <dd>{comprador.telefono}</dd>
          </>
        )}

        <dt>Sorteo</dt>
        <dd>{periodoLargo(sorteo.periodo)}</dd>

        <dt>Importe</dt>
        <dd>{pesos(importe)}</dd>

        {vendedor && (
          <>
            <dt>Vendedor</dt>
            <dd>{vendedor}</dd>
          </>
        )}

        <dt>Fecha</dt>
        <dd>{fechaHora(fecha)}</dd>
      </dl>

      {(anulada || sorteado) && (
        <>
          <hr className="separador" />

          {/* El extracto va acá para que se pueda cotejar contra los números de
              arriba sin tener que ir a buscarlo a otro lado. */}
          {sorteado && extracto && (
            <div style={{ marginBottom: '0.9rem' }}>
              <div className="titulo" style={{ marginBottom: '0.4rem' }}>
                Extracto del sorteo
              </div>
              <Bolillas numeros={extracto} />
            </div>
          )}

          <div style={{ textAlign: 'center' }}>
            {anulada ? (
              <Chip estado="anulada">Anulada</Chip>
            ) : gano ? (
              <Chip estado="gano">¡Jugada ganadora!</Chip>
            ) : (
              <Chip estado="cerrado">No ganó</Chip>
            )}
          </div>
        </>
      )}

      <hr className="separador" />
      <div className="titulo">Conservá este código para reclamar el premio</div>
    </div>
  );
}
