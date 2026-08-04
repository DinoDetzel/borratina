import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { api } from '../api.js';
import BotonCompartir from '../componentes/BotonCompartir.jsx';
import CamposExtracto from '../componentes/CamposExtracto.jsx';
import {
  Bolillas,
  Cargando,
  Chip,
  Dialogo,
  Ficha,
  MensajeError,
  MensajeExito,
  Vacio,
} from '../componentes/comunes.jsx';
import {
  CANTIDAD_EXTRACTO,
  aciertos,
  fechaHora,
  formatearNumero,
  numero,
  periodoLargo,
  pesos,
} from '../utilidades.js';

/** Cuántas jugadas se traen por vez. El backend no acepta más de 500. */
const POR_PAGINA = 500;

/** El sorteo no va acá: lo fija la ruta. */
const SIN_FILTROS = {
  comprador: '',
  codigo: '',
  numeros: '',
  vendedor_id: '',
  incluir_anuladas: 'true',
  solo_ganadoras: '',
};

export default function AdminSorteoDetalle() {
  const { id } = useParams();

  const [sorteo, setSorteo] = useState(null);
  const [resultado, setResultado] = useState(null); // ganadores, vacante y reparto
  const [jugadas, setJugadas] = useState([]);
  // Cuántas coinciden con la búsqueda, que con filtros puestos no es lo mismo
  // que cuántas tiene el sorteo.
  const [total, setTotal] = useState(0);
  // Los dos totales del sorteo entero, sin filtros. Se preguntan aparte en vez
  // de contarlos sobre lo que está en pantalla, porque la lista viene paginada
  // y además puede estar filtrada.
  const [totalSorteo, setTotalSorteo] = useState(0);
  const [validas, setValidas] = useState(0);
  // Para el desplegable del buscador. Van todas las cuentas y no solo las que
  // cargaron algo acá: un vendedor dado de baja igual tiene jugadas viejas, y
  // el admin también carga.
  const [vendedores, setVendedores] = useState([]);

  const [filtros, setFiltros] = useState(SIN_FILTROS);
  // Con qué se armó la lista que está en pantalla. Escribir en el buscador no
  // tiene que cambiarle el criterio al "Ver más" antes de apretar Buscar.
  const aplicados = useRef(SIN_FILTROS);

  const [cargando, setCargando] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [trayendoMas, setTrayendoMas] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [editando, setEditando] = useState(null);

  // Corrección del extracto: `corrigiendo` son los 20 campos como texto, y
  // `confirmando` el cartel que aparece antes de guardar.
  const [corrigiendo, setCorrigiendo] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const traerJugadas = useCallback(
    async (offset, criterios = aplicados.current) => {
      const respuesta = await api.jugadas.listar({
        ...criterios,
        sorteo_id: id,
        limit: POR_PAGINA,
        offset,
      });
      setTotal(respuesta.total);
      setJugadas((previas) => (offset === 0 ? respuesta.jugadas : [...previas, ...respuesta.jugadas]));
    },
    [id],
  );

  const traerTodo = useCallback(
    async (sigueVigente = () => true) => {
      setError('');
      try {
        const { sorteo } = await api.sorteos.uno(id);
        if (!sigueVigente()) return;
        setSorteo(sorteo);

        await traerJugadas(0);

        // Solo interesa el total, así que se pide una sola fila.
        const conAnuladas = await api.jugadas.listar({
          sorteo_id: id,
          incluir_anuladas: 'true',
          limit: 1,
        });
        const soloValidas = await api.jugadas.listar({ sorteo_id: id, limit: 1 });
        if (sigueVigente()) {
          setTotalSorteo(conAnuladas.total);
          setValidas(soloValidas.total);
        }

        // Los ganadores solo existen una vez cargado el extracto: antes de eso
        // el endpoint responde 409 a propósito.
        if (sorteo.estado === 'finalizado') {
          const reparto = await api.sorteos.ganadores(id);
          if (sigueVigente()) setResultado(reparto);
        } else {
          setResultado(null);
        }
      } catch (err) {
        if (sigueVigente()) setError(err.message);
      }
    },
    [id, traerJugadas],
  );

  useEffect(() => {
    // Si falla, el buscador queda sin el desplegable de vendedor y el resto de
    // la pantalla sigue andando: no vale un cartel de error.
    api.usuarios
      .listar()
      .then(({ usuarios }) => setVendedores(usuarios))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let vigente = true;

    setCargando(true);
    traerTodo(() => vigente).finally(() => {
      if (vigente) setCargando(false);
    });

    return () => {
      vigente = false;
    };
  }, [traerTodo]);

  /** Vuelve a listar desde cero con los filtros que se pidan. */
  async function buscar(criterios = filtros) {
    aplicados.current = criterios;
    setBuscando(true);
    setError('');
    try {
      await traerJugadas(0, criterios);
    } catch (err) {
      setError(err.message);
      setJugadas([]);
      setTotal(0);
    } finally {
      setBuscando(false);
    }
  }

  function cambiar(campo, valor) {
    setFiltros((f) => ({ ...f, [campo]: valor }));
  }

  /** Si hay algo distinto de lo que trae la pantalla al abrirse. */
  const hayFiltros = Object.keys(SIN_FILTROS).some((k) => filtros[k] !== SIN_FILTROS[k]);

  /** Corre una acción sobre una jugada y refresca todo lo que pudo cambiar. */
  async function accion(fn, mensaje) {
    setError('');
    setExito('');
    try {
      await fn();
      setExito(mensaje);
      // Anular o restaurar mueve los contadores y, con el extracto cargado,
      // también quién cobra: se refresca la pantalla entera, no solo la lista.
      await traerTodo();
    } catch (err) {
      setError(err.message);
    }
  }

  async function guardarEdicion(evento) {
    evento.preventDefault();
    const { id: jugadaId, numeros, comprador_nombre, comprador_telefono, sorteado } = editando;

    await accion(
      () =>
        api.jugadas.editar(jugadaId, {
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

  /** Guarda el extracto corregido y cuenta qué cambió. */
  async function guardarCorreccion() {
    setGuardando(true);
    setError('');
    try {
      const r = await api.sorteos.corregirResultado(id, corrigiendo.map(Number));

      const perdieron = r.dejaron_de_ganar.map((g) => g.comprador_nombre);
      setExito(
        `Extracto corregido. ${
          r.vacante ? 'Ahora no gana nadie' : `Ahora ganan ${r.ganadores.length}`
        }.${perdieron.length ? ` Dejaron de ganar: ${perdieron.join(', ')}.` : ''}`,
      );

      setConfirmando(false);
      setCorrigiendo(null);
      await traerTodo();
    } catch (err) {
      setError(err.message);
      setConfirmando(false);
    } finally {
      setGuardando(false);
    }
  }

  /** Trae la página siguiente sin perder lo que ya está en pantalla. */
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
  const anuladas = totalSorteo - validas;
  // Con el buscador tocado, el encabezado de la lista habla de la búsqueda; sin
  // tocar, del sorteo.
  const filtrando = Object.keys(SIN_FILTROS).some(
    (k) => aplicados.current[k] !== SIN_FILTROS[k],
  );

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
      <MensajeExito>{exito}</MensajeExito>

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
        <div className="encabezado-tarjeta">
          <h2 style={{ margin: 0 }}>Extracto de la quiniela</h2>
          {sorteo.numeros && !corrigiendo && (
            <button
              className="secundario chico"
              onClick={() => setCorrigiendo(sorteo.numeros.map(formatearNumero))}
            >
              Corregir
            </button>
          )}
        </div>

        {!sorteo.numeros ? (
          <Vacio>
            Todavía no se cargó el extracto. Se carga desde Sorteos, con la carga de jugadas ya
            cerrada.
          </Vacio>
        ) : corrigiendo ? (
          <>
            <p style={{ color: 'var(--tinta-2)', fontSize: '0.85rem', margin: '0.4rem 0 0.9rem' }}>
              Corregí el número que salió mal. Al guardar se vuelve a calcular quién gana, así que
              revisá los {CANTIDAD_EXTRACTO} antes de confirmar.
            </p>

            <CamposExtracto valores={corrigiendo} onCambiar={setCorrigiendo} prefijo="correccion" />

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                onClick={() => setConfirmando(true)}
                disabled={corrigiendo.some((n) => n === '')}
              >
                Guardar corrección
              </button>
              <button className="secundario" onClick={() => setCorrigiendo(null)}>
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ color: 'var(--tinta-2)', fontSize: '0.85rem', margin: '0.4rem 0 0.9rem' }}>
              Los {CANTIDAD_EXTRACTO} números que salieron, en el orden en que se publicaron.
            </p>
            <Bolillas numeros={sorteo.numeros} />

            {sorteo.resultado_corregido_at && (
              <p
                style={{
                  color: 'var(--tinta-apagada)',
                  fontSize: '0.82rem',
                  margin: '0.9rem 0 0',
                }}
              >
                Corregido el {fechaHora(sorteo.resultado_corregido_at)}
                {sorteo.corregido_por && ` por ${sorteo.corregido_por}`}. Antes decía{' '}
                {sorteo.numeros_anteriores?.map(formatearNumero).join(' ')}.
              </p>
            )}
          </>
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

      {editando && (
        <div className="tarjeta">
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
        <div className="encabezado-tarjeta">
          <h2 style={{ margin: 0 }}>Jugadas cargadas ({numero(totalSorteo)})</h2>
          {filtrando && !buscando && (
            <span style={{ color: 'var(--tinta-2)' }}>
              {numero(total)} {total === 1 ? 'resultado' : 'resultados'}
            </span>
          )}
        </div>

        <p style={{ color: 'var(--tinta-2)', fontSize: '0.85rem', marginTop: 0 }}>
          {finalizado
            ? 'En verde, los números que estaban en el extracto.'
            : 'Todo lo que se cargó hasta ahora.'}
          {anuladas > 0 && ' Las anuladas van apagadas: siguen en la lista, pero no cobran.'}
        </p>

        {/* Buscar dentro del sorteo: el comprador que reclama, el comprobante
            que trajo, o los números que dice haber jugado. */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            buscar();
          }}
          style={{ marginBottom: '1rem' }}
        >
          <div className="fila">
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

            <div>
              <label htmlFor="f-vendedor">Vendedor</label>
              <select
                id="f-vendedor"
                value={filtros.vendedor_id}
                onChange={(e) => cambiar('vendedor_id', e.target.value)}
              >
                <option value="">Todos</option>
                {vendedores.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nombre}
                    {!v.activo && ' (inactivo)'}
                  </option>
                ))}
              </select>
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
              <button type="submit" disabled={buscando}>
                {buscando ? 'Buscando…' : 'Buscar'}
              </button>
            </div>
          </div>
        </form>

        {buscando ? (
          <Cargando />
        ) : jugadas.length === 0 ? (
          <Vacio>
            {filtrando
              ? 'Ninguna jugada coincide con la búsqueda.'
              : 'No se cargó ninguna jugada en este sorteo.'}
          </Vacio>
        ) : (
          <>
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
                  {jugadas.map((j) => {
                    const numeros = [j.numero_1, j.numero_2, j.numero_3, j.numero_4];
                    return (
                      <tr key={j.id} className={j.anulada ? 'apagada' : ''}>
                        <td className="codigo">{j.codigo}</td>
                        <td>
                          <Bolillas numeros={numeros} marcadas={aciertos(numeros, sorteo.numeros)} />
                        </td>
                        <td>
                          {j.comprador_nombre}
                          {j.comprador_telefono && (
                            <div style={{ color: 'var(--tinta-apagada)', fontSize: '0.82rem' }}>
                              {j.comprador_telefono}
                            </div>
                          )}
                          {(j.anulada || j.gano) && (
                            <div style={{ marginTop: '0.2rem', display: 'flex', gap: '0.3rem' }}>
                              {j.anulada && <Chip estado="anulada">Anulada</Chip>}
                              {j.gano && <Chip estado="gano">Ganadora</Chip>}
                            </div>
                          )}
                        </td>
                        <td data-movil="Cargó">{j.vendedor}</td>
                        <td
                          style={{
                            color: 'var(--tinta-2)',
                            fontSize: '0.85rem',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {fechaHora(j.created_at)}
                        </td>
                        <td>
                          <div className="acciones-fila">
                            {/* Va también en las anuladas: el comprobante sale con el
                                sello ANULADA y sirve para avisarle al comprador. */}
                            <BotonCompartir
                              codigo={j.codigo}
                              className="enlace"
                              onAviso={(texto, esError) => {
                                setError(esError ? texto : '');
                                setExito(esError ? '' : (texto ?? ''));
                              }}
                            >
                              Enviar
                            </BotonCompartir>
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
                                      numeros: numeros.map((n) => String(n).padStart(2, '0')),
                                      comprador_nombre: j.comprador_nombre,
                                      comprador_telefono: j.comprador_telefono,
                                      sorteado: finalizado,
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
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Sin esto, una búsqueda con más resultados que la página se cortaba
                en silencio: el encabezado decía 340 y la tabla mostraba 100. */}
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

      {confirmando && (
        <Dialogo
          titulo="¿Guardar el extracto corregido?"
          confirmar="Sí, corregir"
          peligro
          ocupado={guardando}
          onCerrar={() => setConfirmando(false)}
          onConfirmar={guardarCorreccion}
        >
          <p>Se vuelve a calcular quién gana. Los números quedan así:</p>

          <div style={{ margin: '0 0 0.9rem' }}>
            <Bolillas numeros={corrigiendo.map(Number)} />
          </div>

          <p style={{ marginBottom: 0 }}>
            {resultado?.vacante
              ? 'Hoy el sorteo figura vacante.'
              : `Hoy figuran ${resultado?.ganadores.length} ganadores.`}{' '}
            Si eso cambia, avisale a quien corresponda: la corrección queda registrada a tu
            nombre.
          </p>
        </Dialogo>
      )}
    </>
  );
}
