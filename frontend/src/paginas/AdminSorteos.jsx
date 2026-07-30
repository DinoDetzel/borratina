import { useEffect, useState } from 'react';

import { api } from '../api.js';
import { Bolillas, Cargando, Chip, MensajeError, MensajeExito, Vacio } from '../componentes/comunes.jsx';
import { fechaHora, periodoActual, periodoLargo, pesos } from '../utilidades.js';

export default function AdminSorteos() {
  const [sorteos, setSorteos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const [periodo, setPeriodo] = useState(periodoActual());
  const [precio, setPrecio] = useState('');
  const [abriendo, setAbriendo] = useState(false);

  const [resultado, setResultado] = useState(['', '', '', '']);
  const [ganadores, setGanadores] = useState(null);

  async function traer() {
    setCargando(true);
    try {
      const { sorteos } = await api.sorteos.listar();
      setSorteos(sorteos);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    traer();
  }, []);

  /** Envuelve una acción para no repetir el manejo de error/éxito en cada botón. */
  async function accion(fn, mensajeExito) {
    setError('');
    setExito('');
    try {
      const respuesta = await fn();
      setExito(mensajeExito);
      await traer();
      return respuesta;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }

  async function abrir(evento) {
    evento.preventDefault();
    setAbriendo(true);
    const ok = await accion(
      () => api.sorteos.abrir(periodo, Number(precio)),
      `Sorteo de ${periodoLargo(periodo)} abierto.`,
    );
    if (ok) setPrecio('');
    setAbriendo(false);
  }

  async function cargarResultado(sorteo) {
    if (resultado.some((n) => n === '')) {
      setError('Completá los 4 números del resultado.');
      return;
    }

    const respuesta = await accion(
      () => api.sorteos.cargarResultado(sorteo.id, resultado.map(Number)),
      'Resultado cargado. El sorteo quedó finalizado.',
    );

    if (respuesta) {
      setGanadores(respuesta);
      setResultado(['', '', '', '']);
    }
  }

  const abierto = sorteos.find((s) => s.estado === 'abierto');
  const cerrado = sorteos.find((s) => s.estado === 'cerrado');

  if (cargando) return <Cargando />;

  return (
    <>
      <div className="encabezado-seccion">
        <h1>Sorteos</h1>
      </div>

      <MensajeError>{error}</MensajeError>
      <MensajeExito>{exito}</MensajeExito>

      {/* Abrir el sorteo del mes. Solo tiene sentido si no hay otro abierto. */}
      <div className="tarjeta">
        <h2 style={{ marginBottom: '0.75rem' }}>Abrir sorteo</h2>

        {abierto ? (
          <div className="aviso">
            Ya hay un sorteo abierto ({periodoLargo(abierto.periodo)}). Cerrá la carga antes
            de abrir el siguiente.
          </div>
        ) : (
          <form onSubmit={abrir}>
            <div className="fila">
              <div>
                <label htmlFor="periodo">Período</label>
                <input
                  id="periodo"
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value)}
                  placeholder="2026-08"
                  pattern="\d{4}-(0[1-9]|1[0-2])"
                  title="Formato AAAA-MM"
                  required
                />
              </div>
              <div>
                <label htmlFor="precio">Precio por jugada</label>
                <input
                  id="precio"
                  type="number"
                  min="1"
                  step="1"
                  value={precio}
                  onChange={(e) => setPrecio(e.target.value)}
                  required
                />
              </div>
              <div style={{ flex: '0 0 auto' }}>
                <button type="submit" disabled={abriendo}>
                  {abriendo ? 'Abriendo…' : 'Abrir'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Cargar el resultado oficial: solo cuando la carga ya está cerrada. */}
      {cerrado && (
        <div className="tarjeta">
          <h2 style={{ marginBottom: '0.4rem' }}>
            Cargar resultado de {periodoLargo(cerrado.periodo)}
          </h2>
          <p style={{ color: 'var(--tinta-2)', fontSize: '0.85rem', marginTop: 0 }}>
            Los 4 números del extracto oficial de la quiniela. El orden no importa.
          </p>

          <div className="numeros" style={{ maxWidth: 260 }}>
            {resultado.map((valor, i) => (
              <input
                key={i}
                inputMode="numeric"
                value={valor}
                placeholder="00"
                aria-label={`Número ganador ${i + 1}`}
                onChange={(e) => {
                  const limpio = e.target.value.replace(/\D/g, '').slice(0, 2);
                  setResultado((prev) => prev.map((n, j) => (j === i ? limpio : n)));
                }}
              />
            ))}
          </div>

          <button style={{ marginTop: '1rem' }} onClick={() => cargarResultado(cerrado)}>
            Cargar resultado y finalizar
          </button>
        </div>
      )}

      {ganadores && (
        <div className="tarjeta">
          <h2 style={{ marginBottom: '0.75rem' }}>
            {ganadores.vacante ? 'Sorteo vacante' : `Ganadores (${ganadores.ganadores.length})`}
          </h2>

          {ganadores.vacante ? (
            <div className="aviso">Nadie acertó la combinación. El pozo no se reparte.</div>
          ) : (
            <>
              <p style={{ marginTop: 0 }}>
                Premio por ganador: <strong>{pesos(ganadores.premio_por_ganador)}</strong>
              </p>
              <div className="tabla-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Comprador</th>
                      <th>Teléfono</th>
                      <th>Vendedor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ganadores.ganadores.map((g) => (
                      <tr key={g.id}>
                        <td>{g.comprador_nombre}</td>
                        <td>{g.comprador_telefono ?? '—'}</td>
                        <td>{g.vendedor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      <div className="tarjeta">
        <h2 style={{ marginBottom: '0.75rem' }}>Todos los sorteos</h2>

        {sorteos.length === 0 ? (
          <Vacio>Todavía no creaste ningún sorteo.</Vacio>
        ) : (
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Precio</th>
                  <th>Resultado</th>
                  <th style={{ textAlign: 'right' }}>Pozo</th>
                  <th>Cerrado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sorteos.map((s) => (
                  <tr key={s.id}>
                    <td>{periodoLargo(s.periodo)}</td>
                    <td>
                      <Chip estado={s.estado}>{s.estado}</Chip>
                    </td>
                    <td className="num">{pesos(s.precio_jugada)}</td>
                    <td>
                      {s.numero_1 == null ? (
                        <span style={{ color: 'var(--tinta-apagada)' }}>—</span>
                      ) : (
                        <Bolillas numeros={[s.numero_1, s.numero_2, s.numero_3, s.numero_4]} />
                      )}
                    </td>
                    <td className="num">{s.pozo_total == null ? '—' : pesos(s.pozo_total)}</td>
                    <td style={{ color: 'var(--tinta-2)', fontSize: '0.85rem' }}>
                      {s.fecha_cierre_carga ? fechaHora(s.fecha_cierre_carga) : '—'}
                    </td>
                    <td>
                      {s.estado === 'abierto' && (
                        <button
                          className="secundario chico"
                          onClick={() =>
                            accion(() => api.sorteos.cerrar(s.id), 'Carga de jugadas cerrada.')
                          }
                        >
                          Cerrar carga
                        </button>
                      )}
                      {s.estado === 'finalizado' && (
                        <button
                          className="secundario chico"
                          onClick={async () => {
                            const r = await accion(
                              () => api.sorteos.ganadores(s.id),
                              'Ganadores del sorteo.',
                            );
                            if (r) setGanadores(r);
                          }}
                        >
                          Ver ganadores
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
