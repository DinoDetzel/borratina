import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { api } from '../api.js';
import { Cargando, Chip, Ficha, MensajeError, Vacio } from '../componentes/comunes.jsx';
import { fechaDia, numero, periodoLargo, pesos } from '../utilidades.js';

/**
 * Todas las cuentas y qué cargó cada una en un sorteo.
 *
 * El panel muestra el podio de los que más cargaron; acá está la lista entera,
 * con los que no cargaron nada incluidos, que son justamente los que uno viene
 * a buscar.
 */
export default function AdminVendedores() {
  // El sorteo viaja en la URL para poder llegar desde el panel sin perder cuál
  // estaba elegido, y para que el enlace se pueda compartir.
  const [parametros, setParametros] = useSearchParams();
  const sorteoId = parametros.get('sorteo') ?? '';

  const [sorteos, setSorteos] = useState([]);
  const [vendedores, setVendedores] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;

    setError('');
    Promise.all([api.dashboard.vendedores(sorteoId), api.sorteos.listar()])
      .then(([v, ls]) => {
        if (!vigente) return;
        setVendedores(v.vendedores);
        setSorteos(ls.sorteos);
        // Sin sorteo en la URL, el backend eligió uno: lo reflejamos en el
        // selector, con replace para no ensuciar el historial del navegador.
        if (!sorteoId && v.sorteo_id) {
          setParametros({ sorteo: String(v.sorteo_id) }, { replace: true });
        }
      })
      .catch((err) => vigente && setError(err.message))
      .finally(() => vigente && setCargando(false));

    return () => {
      vigente = false;
    };
  }, [sorteoId, setParametros]);

  if (cargando) return <Cargando />;

  const cargaron = vendedores.filter((v) => Number(v.cantidad_jugadas) > 0).length;
  const sinCargar = vendedores.length - cargaron;
  const sorteo = sorteos.find((s) => String(s.id) === String(sorteoId));

  return (
    <>
      <div className="encabezado-seccion">
        <div>
          <Link to="/admin" className="volver">
            ← Panel
          </Link>
          <h1 style={{ margin: '0.2rem 0 0' }}>Vendedores</h1>
        </div>

        <div style={{ marginLeft: 'auto' }}>
          <label htmlFor="sorteo" className="visualmente-oculto">
            Sorteo
          </label>
          <select
            id="sorteo"
            value={sorteoId}
            onChange={(e) => setParametros({ sorteo: e.target.value })}
            style={{ width: 'auto' }}
          >
            {sorteos.map((s) => (
              <option key={s.id} value={s.id}>
                {periodoLargo(s.periodo)} — {s.estado}
              </option>
            ))}
          </select>
        </div>
      </div>

      <MensajeError>{error}</MensajeError>

      <div className="grilla" style={{ marginBottom: '1rem' }}>
        <Ficha
          etiqueta="Cuentas"
          valor={numero(vendedores.length)}
          pie="Todas las que existen, activas o no"
        />
        <Ficha
          etiqueta="Cargaron"
          valor={numero(cargaron)}
          pie={sorteo ? `En ${periodoLargo(sorteo.periodo)}` : 'En este sorteo'}
        />
        <Ficha
          etiqueta="Sin cargar"
          valor={numero(sinCargar)}
          pie={sinCargar ? 'No cargaron ninguna jugada' : 'Cargaron todos'}
        />
      </div>

      <div className="tarjeta">
        {vendedores.length === 0 ? (
          <Vacio>Todavía no hay ninguna cuenta creada.</Vacio>
        ) : (
          <div className="tabla-scroll">
            <table className="tabla-a-lista">
              <thead>
                <tr>
                  <th>Vendedor</th>
                  <th style={{ textAlign: 'right' }}>Jugadas</th>
                  <th style={{ textAlign: 'right' }}>Anuladas</th>
                  <th style={{ textAlign: 'right' }}>Recaudación</th>
                  <th style={{ textAlign: 'right' }}>Histórico</th>
                  <th>Última carga</th>
                </tr>
              </thead>
              <tbody>
                {vendedores.map((v) => {
                  const jugadas = Number(v.cantidad_jugadas);
                  return (
                    // La fila apagada dice de un vistazo quién no aportó nada a
                    // este sorteo, que es la pregunta que trae acá.
                    <tr key={v.id} className={jugadas === 0 ? 'apagada' : ''}>
                      <td>
                        {v.nombre}
                        <div
                          style={{
                            color: 'var(--tinta-apagada)',
                            fontSize: '0.82rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                          }}
                        >
                          {v.usuario}
                          {v.rol === 'admin' && <Chip estado="abierto">admin</Chip>}
                          {!v.activo && <Chip estado="anulada">inactiva</Chip>}
                        </div>
                      </td>
                      <td className="num" data-movil="Jugadas">
                        {numero(jugadas)}
                      </td>
                      <td className="num" data-movil="Anuladas">
                        {Number(v.jugadas_anuladas) ? numero(v.jugadas_anuladas) : '—'}
                      </td>
                      <td className="num" data-movil="Recaudó">
                        {pesos(v.recaudacion)}
                      </td>
                      <td className="num" data-movil="Histórico">
                        {numero(v.jugadas_historicas)}
                      </td>
                      <td data-movil="Última carga" style={{ whiteSpace: 'nowrap' }}>
                        {fechaDia(v.ultima_carga)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p
          style={{
            color: 'var(--tinta-apagada)',
            fontSize: '0.82rem',
            margin: '1rem 0 0',
          }}
        >
          Jugadas, anuladas y recaudación son de este sorteo. El histórico y la última carga son
          de todos: sirven para distinguir al que nunca cargó nada del que este mes no cargó.
        </p>
      </div>
    </>
  );
}
