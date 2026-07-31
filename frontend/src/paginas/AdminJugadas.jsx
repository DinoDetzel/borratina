import { useEffect, useState } from 'react';

import { api } from '../api.js';
import { Bolillas, Cargando, Chip, MensajeError, MensajeExito, Vacio } from '../componentes/comunes.jsx';
import { fechaHora, numero, periodoLargo } from '../utilidades.js';

/** Cuántas jugadas se traen por vez. El backend no acepta más de 500. */
const POR_PAGINA = 100;

const SIN_FILTROS = {
  sorteo_id: '',
  comprador: '',
  codigo: '',
  numeros: '',
  incluir_anuladas: 'true',
  solo_ganadoras: '',
};

export default function AdminJugadas() {
  const [sorteos, setSorteos] = useState([]);
  const [jugadas, setJugadas] = useState([]);
  const [total, setTotal] = useState(0);

  const [filtros, setFiltros] = useState(SIN_FILTROS);

  const [cargando, setCargando] = useState(true);
  const [trayendoMas, setTrayendoMas] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [editando, setEditando] = useState(null);

  useEffect(() => {
    api.sorteos.listar().then(({ sorteos }) => setSorteos(sorteos)).catch(() => {});
  }, []);

  async function buscar(nuevosFiltros = filtros) {
    setCargando(true);
    setError('');
    try {
      const { jugadas, total } = await api.jugadas.listar({ ...nuevosFiltros, limit: POR_PAGINA });
      setJugadas(jugadas);
      setTotal(total);
    } catch (err) {
      setError(err.message);
      setJugadas([]);
      setTotal(0);
    } finally {
      setCargando(false);
    }
  }

  /** Trae la página siguiente sin perder lo que ya está en pantalla. */
  async function verMas() {
    setTrayendoMas(true);
    try {
      const respuesta = await api.jugadas.listar({
        ...filtros,
        limit: POR_PAGINA,
        offset: jugadas.length,
      });
      setJugadas((previas) => [...previas, ...respuesta.jugadas]);
      setTotal(respuesta.total);
    } catch (err) {
      setError(err.message);
    } finally {
      setTrayendoMas(false);
    }
  }

  useEffect(() => {
    buscar();
    // Solo en el montaje: después se busca con el botón, para no pegarle a la
    // API en cada tecla del buscador.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cambiar(campo, valor) {
    setFiltros((f) => ({ ...f, [campo]: valor }));
  }

  /** Si hay algo distinto de lo que trae la pantalla al abrirse. */
  const hayFiltros = Object.keys(SIN_FILTROS).some((k) => filtros[k] !== SIN_FILTROS[k]);

  async function accion(fn, mensaje) {
    setError('');
    setExito('');
    try {
      await fn();
      setExito(mensaje);
      await buscar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function guardarEdicion(evento) {
    evento.preventDefault();
    const { id, numeros, comprador_nombre, comprador_telefono, sorteado } = editando;

    await accion(
      () =>
        api.jugadas.editar(id, {
          // Con el sorteo ya sorteado no se mandan: el backend los rechaza, y
          // mandarlos igual haría fallar una corrección de nombre legítima.
          ...(sorteado ? {} : { numeros: numeros.map(Number) }),
          comprador_nombre,
          comprador_telefono: comprador_telefono || null,
        }),
      'Jugada corregida.',
    );
    setEditando(null);
  }

  return (
    <>
      <div className="encabezado-seccion">
        <h1>Jugadas</h1>
        {!cargando && (
          <span style={{ color: 'var(--tinta-2)' }}>
            {numero(total)} {total === 1 ? 'resultado' : 'resultados'}
          </span>
        )}
      </div>

      <MensajeError>{error}</MensajeError>
      <MensajeExito>{exito}</MensajeExito>

      <div className="tarjeta" style={{ marginBottom: '1rem' }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            buscar();
          }}
        >
          <div className="fila">
            <div>
              <label htmlFor="f-sorteo">Sorteo</label>
              <select
                id="f-sorteo"
                value={filtros.sorteo_id}
                onChange={(e) => cambiar('sorteo_id', e.target.value)}
              >
                <option value="">Actual</option>
                {sorteos.map((s) => (
                  <option key={s.id} value={s.id}>
                    {periodoLargo(s.periodo)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="f-codigo">Comprobante</label>
              <input
                id="f-codigo"
                value={filtros.codigo}
                onChange={(e) => cambiar('codigo', e.target.value)}
                placeholder="260815-K7M3XQ"
              />
            </div>

            <div>
              <label htmlFor="f-comprador">Comprador</label>
              <input
                id="f-comprador"
                value={filtros.comprador}
                onChange={(e) => cambiar('comprador', e.target.value)}
                placeholder="Nombre"
              />
            </div>

            <div>
              <label htmlFor="f-numeros">Números</label>
              <input
                id="f-numeros"
                value={filtros.numeros}
                onChange={(e) => cambiar('numeros', e.target.value)}
                placeholder="7,23,45,88"
              />
            </div>

          </div>

          {/* Las casillas a la izquierda y los botones contra el borde derecho:
              lo que acota la búsqueda, separado de lo que la dispara. */}
          <div className="barra-filtros">
            <label className="casilla">
              <input
                type="checkbox"
                checked={filtros.incluir_anuladas === 'true'}
                onChange={(e) => cambiar('incluir_anuladas', e.target.checked ? 'true' : '')}
              />
              Mostrar también las anuladas
            </label>

            {/* La lista con la que se pagan los premios. */}
            <label className="casilla">
              <input
                type="checkbox"
                checked={filtros.solo_ganadoras === 'true'}
                onChange={(e) => {
                  const marcado = e.target.checked ? 'true' : '';
                  // Una anulada no cobra aunque acierte: mostrarla en la lista de
                  // pagos sería pedir un error.
                  setFiltros((f) => ({
                    ...f,
                    solo_ganadoras: marcado,
                    incluir_anuladas: marcado ? '' : f.incluir_anuladas,
                  }));
                }}
              />
              Solo las ganadoras
            </label>

            <div className="acciones-fila" style={{ marginLeft: 'auto' }}>
              {hayFiltros && (
                <button
                  type="button"
                  className="secundario"
                  onClick={() => {
                    setFiltros(SIN_FILTROS);
                    buscar(SIN_FILTROS);
                  }}
                >
                  Limpiar
                </button>
              )}
              <button type="submit">Buscar</button>
            </div>
          </div>
        </form>
      </div>

      {editando && (
        <div className="tarjeta" style={{ marginBottom: '1rem' }}>
          <h2 style={{ marginBottom: '0.75rem' }}>
            Corregir jugada <span className="codigo">{editando.codigo}</span>
          </h2>

          <form onSubmit={guardarEdicion}>
            <div className="campo">
              <label>Números</label>
              <div className="numeros" style={{ maxWidth: 260 }}>
                {editando.numeros.map((valor, i) => (
                  <input
                    key={i}
                    inputMode="numeric"
                    value={valor}
                    aria-label={`Número ${i + 1}`}
                    // Con el extracto cargado, cambiar los números es elegir
                    // quién gana. Lo impide el backend; acá ni se ofrece.
                    disabled={editando.sorteado}
                    onChange={(e) => {
                      const limpio = e.target.value.replace(/\D/g, '').slice(0, 2);
                      setEditando((prev) => ({
                        ...prev,
                        numeros: prev.numeros.map((n, j) => (j === i ? limpio : n)),
                      }));
                    }}
                  />
                ))}
              </div>

              <p
                style={{
                  color: 'var(--tinta-apagada)',
                  fontSize: '0.8rem',
                  margin: '0.4rem 0 0',
                }}
              >
                {editando.sorteado
                  ? 'Este sorteo ya se sorteó: los números no se tocan más. El nombre y el teléfono sí se pueden corregir.'
                  : 'Se guarda lo que decían antes, por si después hay que mostrarlo.'}
              </p>
            </div>

            <div className="fila" style={{ marginTop: '0.9rem' }}>
              <div>
                <label htmlFor="e-nombre">Comprador</label>
                <input
                  id="e-nombre"
                  value={editando.comprador_nombre}
                  onChange={(e) =>
                    setEditando((p) => ({ ...p, comprador_nombre: e.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <label htmlFor="e-telefono">Teléfono</label>
                <input
                  id="e-telefono"
                  value={editando.comprador_telefono ?? ''}
                  onChange={(e) =>
                    setEditando((p) => ({ ...p, comprador_telefono: e.target.value }))
                  }
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="submit">Guardar</button>
              <button type="button" className="secundario" onClick={() => setEditando(null)}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="tarjeta">
        {cargando ? (
          <Cargando />
        ) : jugadas.length === 0 ? (
          <Vacio>Ninguna jugada coincide con la búsqueda.</Vacio>
        ) : (
          <div className="tabla-scroll">
            <table className="tabla-a-lista">
              <thead>
                <tr>
                  <th>Comprobante</th>
                  <th>Números</th>
                  <th>Comprador</th>
                  <th>Vendedor</th>
                  <th>Cargada</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {jugadas.map((j) => (
                  <tr key={j.id} className={j.anulada ? 'apagada' : ''}>
                    <td className="codigo">{j.codigo}</td>
                    <td>
                      <Bolillas numeros={[j.numero_1, j.numero_2, j.numero_3, j.numero_4]} />
                      {/* El estado va pegado a los números y no abajo del nombre:
                          `gano` es null mientras el sorteo no se haya sorteado,
                          que no es lo mismo que "no ganó", y ahí no se muestra nada. */}
                      {(j.anulada || j.gano) && (
                        <div style={{ marginTop: '0.3rem', display: 'flex', gap: '0.3rem' }}>
                          {j.anulada && <Chip estado="anulada">Anulada</Chip>}
                          {j.gano && <Chip estado="gano">Ganadora</Chip>}
                        </div>
                      )}
                    </td>
                    <td>
                      {j.comprador_nombre}
                      {j.comprador_telefono && (
                        <div style={{ color: 'var(--tinta-apagada)', fontSize: '0.82rem' }}>
                          {j.comprador_telefono}
                        </div>
                      )}
                    </td>
                    <td data-movil="Cargó">{j.vendedor}</td>
                    <td style={{ color: 'var(--tinta-2)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      {fechaHora(j.created_at)}
                    </td>
                    <td>
                      <div className="acciones-fila">
                        {j.anulada ? (
                          <button
                            className="enlace"
                            onClick={() =>
                              accion(() => api.jugadas.restaurar(j.id), 'Jugada restaurada.')
                            }
                          >
                            Restaurar
                          </button>
                        ) : (
                          <>
                            <button
                              className="enlace"
                              onClick={() =>
                                setEditando({
                                  id: j.id,
                                  codigo: j.codigo,
                                  numeros: [j.numero_1, j.numero_2, j.numero_3, j.numero_4].map(
                                    (n) => String(n).padStart(2, '0'),
                                  ),
                                  comprador_nombre: j.comprador_nombre,
                                  comprador_telefono: j.comprador_telefono,
                                  sorteado: j.sorteo_estado === 'finalizado',
                                })
                              }
                            >
                              Corregir
                            </button>
                            <button
                              className="enlace peligro"
                              onClick={() =>
                                accion(() => api.jugadas.anular(j.id), 'Jugada anulada.')
                              }
                            >
                              Anular
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Sin esto, una búsqueda con más de 100 resultados se cortaba en
            silencio: el encabezado decía 340 y la tabla mostraba 100. */}
        {!cargando && jugadas.length < total && (
          <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button className="secundario" onClick={verMas} disabled={trayendoMas}>
              {trayendoMas ? 'Trayendo…' : 'Ver más'}
            </button>
            <span style={{ color: 'var(--tinta-2)', fontSize: '0.85rem' }}>
              {numero(jugadas.length)} de {numero(total)}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
