import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { api } from '../api.js';
import { Bolillas, Cargando, Chip, Ficha, MensajeError, Vacio } from '../componentes/comunes.jsx';
import {
  CANTIDAD_EXTRACTO,
  aciertos,
  fechaHora,
  numero,
  periodoLargo,
  pesos,
} from '../utilidades.js';

/** Cuántas jugadas se traen por vez. El backend no acepta más de 500. */
const POR_PAGINA = 500;

export default function AdminSorteoDetalle() {
  const { id } = useParams();

  const [sorteo, setSorteo] = useState(null);
  const [resultado, setResultado] = useState(null); // ganadores, vacante y reparto
  const [jugadas, setJugadas] = useState([]);
  const [total, setTotal] = useState(0);
  // Las que no están anuladas. Se pregunta aparte en vez de contarlas sobre lo
  // que está en pantalla, porque la lista puede venir paginada.
  const [validas, setValidas] = useState(0);

  const [cargando, setCargando] = useState(true);
  const [trayendoMas, setTrayendoMas] = useState(false);
  const [error, setError] = useState('');

  const traerJugadas = useCallback(
    async (offset) => {
      const respuesta = await api.jugadas.listar({
        sorteo_id: id,
        incluir_anuladas: 'true',
        limit: POR_PAGINA,
        offset,
      });
      setTotal(respuesta.total);
      setJugadas((previas) => (offset === 0 ? respuesta.jugadas : [...previas, ...respuesta.jugadas]));
    },
    [id],
  );

  useEffect(() => {
    let vigente = true;

    (async () => {
      setCargando(true);
      setError('');
      try {
        const { sorteo } = await api.sorteos.uno(id);
        if (!vigente) return;
        setSorteo(sorteo);

        await traerJugadas(0);

        const soloValidas = await api.jugadas.listar({ sorteo_id: id, limit: 1 });
        if (vigente) setValidas(soloValidas.total);

        // Los ganadores solo existen una vez cargado el extracto: antes de eso
        // el endpoint responde 409 a propósito.
        if (sorteo.estado === 'finalizado') {
          const reparto = await api.sorteos.ganadores(id);
          if (vigente) setResultado(reparto);
        } else {
          setResultado(null);
        }
      } catch (err) {
        if (vigente) setError(err.message);
      } finally {
        if (vigente) setCargando(false);
      }
    })();

    return () => {
      vigente = false;
    };
  }, [id, traerJugadas]);

  async function verMas() {
    setTrayendoMas(true);
    try {
      await traerJugadas(jugadas.length);
    } catch (err) {
      setError(err.message);
    } finally {
      setTrayendoMas(false);
    }
  }

  if (cargando) return <Cargando />;
  if (!sorteo) {
    return (
      <>
        <MensajeError>{error || 'No existe ese sorteo.'}</MensajeError>
        <Link to="/admin/sorteos">← Volver a sorteos</Link>
      </>
    );
  }

  const finalizado = sorteo.estado === 'finalizado';
  const anuladas = total - validas;

  return (
    <>
      <div className="encabezado-seccion">
        <div>
          <Link to="/admin/sorteos" className="volver">
            ← Sorteos
          </Link>
          <h1 style={{ margin: '0.2rem 0 0' }}>
            Sorteo de {periodoLargo(sorteo.periodo)} <Chip estado={sorteo.estado} />
          </h1>
        </div>
      </div>

      <MensajeError>{error}</MensajeError>

      {/* Lo primero que se quiere saber: si hubo ganadores o quedó vacante. */}
      {finalizado && resultado && (
        <div className="grilla" style={{ marginBottom: '1rem' }}>
          <Ficha
            etiqueta="Resultado"
            valor={
              resultado.vacante
                ? 'Vacante'
                : `${resultado.ganadores.length} ganador${resultado.ganadores.length === 1 ? '' : 'es'}`
            }
            pie={
              resultado.vacante
                ? `Ninguna de las ${numero(validas)} jugadas acertó los 4 números`
                : 'Acertaron sus 4 números dentro del extracto'
            }
          />
          <Ficha
            etiqueta="Pozo"
            valor={pesos(sorteo.pozo)}
            pie={
              resultado.vacante
                ? 'No se reparte'
                : `${pesos(resultado.premio_por_ganador)} para cada uno`
            }
          />
          <Ficha
            etiqueta="Jugadas válidas"
            valor={numero(validas)}
            pie={
              anuladas
                ? `${numero(anuladas)} anulada${anuladas === 1 ? '' : 's'}, que no jugaban`
                : 'Ninguna anulada'
            }
          />
        </div>
      )}

      <div className="tarjeta">
        <h2 style={{ marginBottom: '0.4rem' }}>Extracto de la quiniela</h2>

        {sorteo.numeros ? (
          <>
            <p style={{ color: 'var(--tinta-2)', fontSize: '0.85rem', marginTop: 0 }}>
              Los {CANTIDAD_EXTRACTO} números que salieron, en el orden en que se publicaron.
            </p>
            <Bolillas numeros={sorteo.numeros} />
          </>
        ) : (
          <Vacio>
            Todavía no se cargó el extracto. Se carga desde Sorteos, con la carga de jugadas ya
            cerrada.
          </Vacio>
        )}
      </div>

      {finalizado && resultado && !resultado.vacante && (
        <div className="tarjeta">
          <h2 style={{ marginBottom: '0.4rem' }}>
            Quiénes cobran ({resultado.ganadores.length})
          </h2>
          <p style={{ color: 'var(--tinta-2)', fontSize: '0.85rem', marginTop: 0 }}>
            {pesos(resultado.premio_por_ganador)} cada uno.
          </p>

          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th>Comprador</th>
                  <th>Teléfono</th>
                  <th>Números</th>
                  <th>Vendedor</th>
                </tr>
              </thead>
              <tbody>
                {resultado.ganadores.map((g) => (
                  <tr key={g.id}>
                    <td>{g.comprador_nombre}</td>
                    <td>{g.comprador_telefono ?? '—'}</td>
                    <td>
                      <Bolillas
                        numeros={[g.numero_1, g.numero_2, g.numero_3, g.numero_4]}
                        marcadas={[true, true, true, true]}
                      />
                    </td>
                    <td>{g.vendedor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="tarjeta">
        <h2 style={{ marginBottom: '0.4rem' }}>Jugadas cargadas ({numero(total)})</h2>
        <p style={{ color: 'var(--tinta-2)', fontSize: '0.85rem', marginTop: 0 }}>
          {finalizado
            ? 'En verde, los números que estaban en el extracto.'
            : 'Todo lo que se cargó hasta ahora.'}
          {anuladas > 0 && ' Las anuladas van apagadas: siguen en la lista, pero no cobran.'}
        </p>

        {jugadas.length === 0 ? (
          <Vacio>No se cargó ninguna jugada en este sorteo.</Vacio>
        ) : (
          <>
            <div className="tabla-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Comprobante</th>
                    <th>Números</th>
                    <th>Comprador</th>
                    <th>Vendedor</th>
                    <th>Cargada</th>
                  </tr>
                </thead>
                <tbody>
                  {jugadas.map((j) => {
                    const numeros = [j.numero_1, j.numero_2, j.numero_3, j.numero_4];
                    return (
                      <tr key={j.id} style={{ opacity: j.anulada ? 0.55 : 1 }}>
                        <td className="codigo">{j.codigo}</td>
                        <td>
                          <Bolillas numeros={numeros} marcadas={aciertos(numeros, sorteo.numeros)} />
                        </td>
                        <td>
                          {j.comprador_nombre}
                          {(j.anulada || j.gano) && (
                            <div style={{ marginTop: '0.2rem', display: 'flex', gap: '0.3rem' }}>
                              {j.anulada && <Chip estado="anulada">Anulada</Chip>}
                              {j.gano && <Chip estado="gano">Ganadora</Chip>}
                            </div>
                          )}
                        </td>
                        <td>{j.vendedor}</td>
                        <td style={{ color: 'var(--tinta-2)', fontSize: '0.85rem' }}>
                          {fechaHora(j.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {jugadas.length < total && (
              <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button className="secundario" onClick={verMas} disabled={trayendoMas}>
                  {trayendoMas ? 'Trayendo…' : 'Ver más'}
                </button>
                <span style={{ color: 'var(--tinta-2)', fontSize: '0.85rem' }}>
                  {numero(jugadas.length)} de {numero(total)}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
