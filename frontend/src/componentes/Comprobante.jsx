import { fechaDia, formatearNumero, pesos } from '../utilidades.js';

/**
 * El comprobante que se le entrega al comprador: el talonario del club,
 * reproducido tal cual, con los datos de la jugada rellenados.
 *
 * El backend manda datos, no HTML; el maquetado es de acá. Las medidas están en
 * píxeles y no en variables del sistema a propósito: esto no es una pantalla más
 * de la app, es una pieza impresa que tiene que salir siempre igual, sin que la
 * cambie un ajuste de tipografía hecho para otra pantalla.
 *
 * El ancho fijo de 720px se escala con `zoom` para que entre en un teléfono y en
 * una hoja: es la única forma de que las proporciones del diseño no se muevan.
 */
export default function Comprobante({ comprobante }) {
  const { codigo, numeros, comprador, sorteo, importe, anulada } = comprobante;

  const rojo = '#e04b2f';
  const crema = '#f7f4ec';

  return (
    <div className="comprobante-club">
      <div className="hoja">
        {anulada && <div className="sello-anulada">ANULADA</div>}

        {/* Escudo y nombre del club */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ width: 126, height: 152, flex: '0 0 auto', position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: rojo,
                clipPath:
                  'path("M 3 26 C 3 10 12 3 28 3 H 98 C 114 3 123 10 123 26 V 74 C 123 112 100 136 63 149 C 26 136 3 112 3 74 Z")',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  color: crema,
                  fontWeight: 800,
                  fontSize: 29,
                  lineHeight: 1.02,
                  paddingBottom: 22,
                }}
              >
                <div style={{ marginLeft: -22 }}>C.</div>
                <div>D.</div>
                <div style={{ marginLeft: 22 }}>S.</div>
              </div>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
            <div className="cursiva" style={{ fontSize: 74, lineHeight: 0.9, letterSpacing: -1 }}>
              al Rojo Vivo!!!
            </div>
            <div
              style={{
                fontWeight: 800,
                fontSize: 35,
                lineHeight: 1,
                letterSpacing: -0.6,
                marginTop: 8,
                whiteSpace: 'nowrap',
              }}
            >
              CLUB DEPORTIVO SARMIENTO
            </div>
          </div>
        </div>

        {/* Pozo y período */}
        <div style={{ display: 'flex', gap: 20, marginTop: 20, alignItems: 'flex-start' }}>
          <div style={{ width: 250, flex: '0 0 auto' }}>
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  border: `3px solid ${rojo}`,
                  height: 86,
                  marginTop: 16,
                  display: 'flex',
                  alignItems: 'flex-end',
                  padding: '0 10px 8px',
                  gap: 8,
                }}
              >
                <span className="cursiva" style={{ fontSize: 32, lineHeight: 1 }}>
                  $
                </span>
                <span
                  style={{ flex: 1, fontWeight: 700, fontSize: 34, lineHeight: 1.05, textAlign: 'right' }}
                >
                  {sorteo.pozo == null ? '' : new Intl.NumberFormat('es-AR').format(sorteo.pozo)}
                </span>
              </div>
              <div
                className="cursiva"
                style={{
                  position: 'absolute',
                  top: -8,
                  left: 6,
                  background: crema,
                  padding: '0 8px',
                  fontSize: 44,
                  lineHeight: 1,
                }}
              >
                Pozo
              </div>
            </div>
            <div className="condensada">
              EN CASO DE HABER MÁS DE UN
              <br />
              GANADOR EL POZO SE DIVIDE
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0, paddingTop: 14 }}>
            <div
              style={{
                background: rojo,
                padding: '6px 14px 5px',
                display: 'flex',
                alignItems: 'baseline',
                gap: 10,
              }}
            >
              <span className="cursiva" style={{ fontSize: 40, lineHeight: 1, color: crema }}>
                Sortea el
              </span>
              <span
                style={{
                  flex: 1,
                  textAlign: 'center',
                  fontWeight: 700,
                  fontSize: 30,
                  lineHeight: 1,
                  color: crema,
                  letterSpacing: 1,
                }}
              >
                {/* El día del sorteo es el día en que cierra la carga. La hora
                    no va: en el papel no significa nada. */}
                {fechaDia(sorteo.sortea_el)}
              </span>
            </div>
            <div
              style={{
                background: rojo,
                color: crema,
                fontWeight: 700,
                fontSize: 17,
                letterSpacing: 0.2,
                padding: '3px 14px 5px',
                textAlign: 'center',
              }}
            >
              POR QUINIELA DE LA CIUDAD NOCTURNA
            </div>
            <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 44, lineHeight: 1, marginTop: 12 }}>
              VALOR {pesos(importe)}
            </div>
          </div>
        </div>

        {/* Comprador */}
        <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="renglon">
            <span style={{ fontWeight: 700, fontSize: 26 }}>Nombre:</span>
            <span className="puntos">{comprador.nombre}</span>
          </div>
          <div className="renglon">
            <span style={{ fontWeight: 700, fontSize: 26 }}>Teléfono:</span>
            <span className="puntos">{comprador.telefono ?? ''}</span>
          </div>
        </div>

        <div style={{ textAlign: 'center', fontStyle: 'italic', fontWeight: 500, fontSize: 30, marginTop: 20 }}>
          Números elegidos ({numeros.length})
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${numeros.length}, 1fr)`,
            gap: 14,
            marginTop: 12,
          }}
        >
          {numeros.map((n, i) => (
            <div
              key={i}
              style={{
                border: `2px solid ${rojo}`,
                height: 84,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 46,
                color: '#1a1a1a',
              }}
            >
              {formatearNumero(n)}
            </div>
          ))}
        </div>

        <div
          style={{
            textAlign: 'center',
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 19,
            lineHeight: 1.25,
            marginTop: 14,
          }}
        >
          Para hacerce acreedor del sorteo, los números elegidos, deberán figurar
          <br />
          en los <strong style={{ fontWeight: 700 }}>20 primeros</strong> premios de la Quiniela de la
          Ciudad Nocturna.
          <br />
          El premio prescribe a los 10 días porteriores al sorteo.
        </div>

        <div className="asteriscos">* * * * * * * * * * * * * * * * * * * * * * * * * * * *</div>

        {/* El código son 13 caracteres: con el cuerpo del diseño original la
            línea se partía en dos. Se achica lo justo para que entre entera,
            porque es el dato con el que el comprador viene a reclamar. */}
        <div
          style={{
            textAlign: 'center',
            color: '#1a1a1a',
            fontWeight: 500,
            fontSize: 34,
            lineHeight: 1.1,
            letterSpacing: 0.5,
            marginTop: 10,
            whiteSpace: 'nowrap',
          }}
        >
          N° de comprobante: <strong style={{ fontWeight: 700 }}>{codigo}</strong>
        </div>
      </div>
    </div>
  );
}
