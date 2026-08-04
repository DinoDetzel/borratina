import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { api } from '../api.js';
import CampoFechaHora from '../componentes/CampoFechaHora.jsx';
import CamposExtracto from '../componentes/CamposExtracto.jsx';
import { Bolillas, Cargando, Chip, MensajeError, MensajeExito, Vacio } from '../componentes/comunes.jsx';
import {
  CANTIDAD_EXTRACTO,
  fechaHora,
  finDelPeriodo,
  paraInputFecha,
  periodoActual,
  periodoLargo,
  pesos,
} from '../utilidades.js';

export default function AdminSorteos() {
  const navegar = useNavigate();

  const [sorteos, setSorteos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const [periodo, setPeriodo] = useState(periodoActual());
  const [precio, setPrecio] = useState('');
  const [pozo, setPozo] = useState('');
  const [abriendo, setAbriendo] = useState(false);

  // Por defecto la carga arranca ahora y cierra al terminar el mes del período:
  // es lo que se hace casi siempre, y así el admin solo toca lo que quiere cambiar.
  const [inicia, setInicia] = useState(() => paraInputFecha(new Date()));
  const [finaliza, setFinaliza] = useState(() => paraInputFecha(finDelPeriodo(periodoActual())));

  // Corrección de un sorteo ya abierto.
  const [pozoEditado, setPozoEditado] = useState('');
  const [iniciaEditado, setIniciaEditado] = useState('');
  const [finalizaEditado, setFinalizaEditado] = useState('');

  // El extracto oficial de la quiniela: 20 números.
  const [resultado, setResultado] = useState(() => Array(CANTIDAD_EXTRACTO).fill(''));

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
      () =>
        api.sorteos.abrir({
          periodo,
          precio_jugada: Number(precio),
          pozo: Number(pozo),
          // El input da hora local; new Date la pasa a UTC para el backend.
          inicia_at: new Date(inicia).toISOString(),
          finaliza_at: new Date(finaliza).toISOString(),
        }),
      `Sorteo de ${periodoLargo(periodo)} abierto con un pozo de ${pesos(Number(pozo))}.`,
    );
    if (ok) {
      setPrecio('');
      setPozo('');
    }
    setAbriendo(false);
  }

  /** Al cambiar el período, el cierre por defecto se mueve al fin de ese mes. */
  function cambiarPeriodo(valor) {
    setPeriodo(valor);
    const fin = finDelPeriodo(valor);
    if (fin) setFinaliza(paraInputFecha(fin));
  }

  async function cargarResultado(sorteo) {
    const faltan = resultado.filter((n) => n === '').length;
    if (faltan > 0) {
      setError(`Faltan ${faltan} de los ${CANTIDAD_EXTRACTO} números del extracto.`);
      return;
    }

    const respuesta = await accion(
      () => api.sorteos.cargarResultado(sorteo.id, resultado.map(Number)),
      'Extracto cargado. El sorteo quedó finalizado.',
    );

    // Cargar el extracto se hace para ver quién ganó: se va derecho ahí.
    if (respuesta) {
      setResultado(Array(CANTIDAD_EXTRACTO).fill(''));
      navegar(`/admin/sorteos/${sorteo.id}`);
    }
  }

  const abierto = sorteos.find((s) => s.estado === 'abierto');
  const cerrado = sorteos.find((s) => s.estado === 'cerrado');

  // Los campos de corrección arrancan con las fechas que el sorteo ya tiene, así
  // el admin ve lo que hay y toca solo lo que quiere mover.
  useEffect(() => {
    if (!abierto) return;
    setIniciaEditado(paraInputFecha(abierto.inicia_at));
    setFinalizaEditado(paraInputFecha(abierto.finaliza_at));
  }, [abierto]);

  if (cargando) return <Cargando />;

  return (
    <>
      <div className="encabezado-seccion">
        <h1>Sorteos</h1>
      </div>

      <MensajeError>{error}</MensajeError>
      <MensajeExito>{exito}</MensajeExito>

      {/* Abrir el sorteo del mes solo tiene sentido si no hay otro abierto: con
          uno abierto, esta tarjeta se reemplaza por la de administrarlo. */}
      {!abierto && (
        <div className="tarjeta">
          <h2 style={{ marginBottom: '0.75rem' }}>Abrir sorteo</h2>

          <form onSubmit={abrir}>
            <div className="fila">
              <div>
                <label htmlFor="periodo">Período</label>
                <input
                  id="periodo"
                  value={periodo}
                  onChange={(e) => cambiarPeriodo(e.target.value)}
                  placeholder="2026-08"
                  pattern="\d{4}-(0[1-9]|1[0-2])"
                  title="Formato AAAA-MM"
                  required
                />
              </div>
              <div>
                <label htmlFor="pozo">Pozo</label>
                <input
                  id="pozo"
                  type="number"
                  min="1"
                  step="1"
                  value={pozo}
                  onChange={(e) => setPozo(e.target.value)}
                  placeholder="1500000"
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
                  placeholder="2000"
                  required
                />
              </div>
            </div>

            {/* Ventana de carga: fuera de estas fechas no se puede cargar. */}
            <div className="fila" style={{ marginTop: '0.9rem' }}>
              <CampoFechaHora
                id="inicia"
                etiqueta="La carga abre"
                valor={inicia}
                onCambiar={setInicia}
              />
              <CampoFechaHora
                id="finaliza"
                etiqueta="La carga cierra"
                valor={finaliza}
                onCambiar={setFinaliza}
                minFecha={inicia.split('T')[0]}
              />
              <div style={{ flex: '0 0 auto' }}>
                <button type="submit" disabled={abriendo}>
                  {abriendo ? 'Abriendo…' : 'Abrir'}
                </button>
              </div>
            </div>

            <p style={{ color: 'var(--tinta-apagada)', fontSize: '0.82rem', marginBottom: 0 }}>
              Fuera de esas fechas los vendedores no van a poder cargar, aunque el sorteo
              figure abierto.
              {pozo > 0 && precio > 0 && (
                <> Hacen falta {Math.ceil(pozo / precio)} jugadas para cubrir el pozo.</>
              )}
            </p>
          </form>
        </div>
      )}

      {/* Lo que se puede tocar mientras la carga sigue abierta. Después no: el
          premio ya se anunció con jugadas hechas. Las dos cosas van juntas
          porque son las dos únicas que se corrigen sobre la marcha. */}
      {abierto && (
        <div className="tarjeta">
          <div className="encabezado-tarjeta">
            <h2 style={{ margin: 0 }}>Sorteo de {periodoLargo(abierto.periodo)}</h2>
            <Chip estado="abierto">carga abierta</Chip>
          </div>

          <div className="partida" style={{ marginTop: '1.1rem' }}>
            <div>
          <h3 style={{ margin: '0 0 0.3rem' }}>Pozo</h3>
          <p style={{ color: 'var(--tinta-2)', fontSize: '0.85rem', marginTop: 0 }}>
            Ahora es <strong>{pesos(abierto.pozo)}</strong>.
          </p>

          <form
            className="fila"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await accion(
                () => api.sorteos.cambiarPozo(abierto.id, Number(pozoEditado)),
                `Pozo actualizado a ${pesos(Number(pozoEditado))}.`,
              );
              if (ok) setPozoEditado('');
            }}
          >
            <div>
              <label htmlFor="pozo-nuevo">Nuevo pozo</label>
              <input
                id="pozo-nuevo"
                type="number"
                min="1"
                step="1"
                value={pozoEditado}
                onChange={(e) => setPozoEditado(e.target.value)}
                placeholder={String(abierto.pozo)}
                required
              />
            </div>
            <div style={{ flex: '0 0 auto' }}>
              <button type="submit" className="secundario">
                Cambiar pozo
              </button>
            </div>
          </form>
            </div>

            <div>
          <h3 style={{ margin: '0 0 0.3rem' }}>Fechas de carga</h3>
          {/* Sin punto final: el formato en español ya termina en "p. m." */}
          <p style={{ color: 'var(--tinta-2)', fontSize: '0.85rem', marginTop: 0 }}>
            Abre el <strong>{fechaHora(abierto.inicia_at)}</strong> y cierra el{' '}
            <strong>{fechaHora(abierto.finaliza_at)}</strong>
          </p>

          <form
            className="fila"
            onSubmit={async (e) => {
              e.preventDefault();
              await accion(
                () =>
                  api.sorteos.cambiarVentana(
                    abierto.id,
                    new Date(iniciaEditado).toISOString(),
                    new Date(finalizaEditado).toISOString(),
                  ),
                'Fechas de carga actualizadas.',
              );
            }}
          >
            <CampoFechaHora
              id="inicia-editado"
              etiqueta="La carga abre"
              valor={iniciaEditado}
              onCambiar={setIniciaEditado}
            />
            <CampoFechaHora
              id="finaliza-editado"
              etiqueta="La carga cierra"
              valor={finalizaEditado}
              onCambiar={setFinalizaEditado}
              minFecha={iniciaEditado.split('T')[0]}
            />
            <div style={{ flex: '0 0 auto' }}>
              <button type="submit" className="secundario">
                Cambiar fechas
              </button>
            </div>
          </form>
            </div>
          </div>

          <p style={{ color: 'var(--tinta-apagada)', fontSize: '0.82rem', margin: '1.1rem 0 0' }}>
            Para abrir el sorteo del mes que viene hay que cerrar esta carga primero.
          </p>
        </div>
      )}

      {/* Cargar el resultado oficial: solo cuando la carga ya está cerrada. */}
      {cerrado && (
        <div className="tarjeta">
          <h2 style={{ marginBottom: '0.4rem' }}>
            Cargar extracto de {periodoLargo(cerrado.periodo)}
          </h2>
          <p style={{ color: 'var(--tinta-2)', fontSize: '0.85rem', marginTop: 0 }}>
            Los {CANTIDAD_EXTRACTO} números del extracto oficial de la quiniela, en el orden en
            que salieron. Gana quien tenga sus 4 números acá dentro.
          </p>

          <CamposExtracto valores={resultado} onCambiar={setResultado} />

          <p style={{ color: 'var(--tinta-apagada)', fontSize: '0.82rem', marginBottom: 0 }}>
            {resultado.filter((n) => n !== '').length} de {CANTIDAD_EXTRACTO} cargados.
          </p>

          <button style={{ marginTop: '1rem' }} onClick={() => cargarResultado(cerrado)}>
            Cargar extracto y finalizar
          </button>
        </div>
      )}

      <div className="tarjeta">
        <h2 style={{ marginBottom: '0.75rem' }}>Todos los sorteos</h2>

        {sorteos.length === 0 ? (
          <Vacio>Todavía no creaste ningún sorteo.</Vacio>
        ) : (
          <div className="tabla-scroll">
            <table className="tabla-a-lista">
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Precio</th>
                  {/* Los 20 números no entran en un teléfono: están en el
                      detalle del sorteo, a un toque del período. */}
                  <th className="oculta-en-movil">Resultado</th>
                  <th style={{ textAlign: 'right' }}>Pozo</th>
                  <th>Carga</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sorteos.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {/* Se entra al detalle desde el período, no solo desde el
                          botón: los sorteos sin finalizar también tienen algo
                          que mirar (lo que se lleva cargado). */}
                      <Link to={`/admin/sorteos/${s.id}`}>{periodoLargo(s.periodo)}</Link>
                    </td>
                    <td>
                      <Chip estado={s.estado}>{s.estado}</Chip>
                    </td>
                    <td className="num" data-movil="Jugada a">
                      {pesos(s.precio_jugada)}
                    </td>
                    <td className="oculta-en-movil">
                      {s.numeros ? (
                        <Bolillas numeros={s.numeros} compactas />
                      ) : (
                        <span style={{ color: 'var(--tinta-apagada)' }}>—</span>
                      )}
                    </td>
                    <td className="num" data-movil="Pozo">
                      {pesos(s.pozo)}
                    </td>
                    <td style={{ color: 'var(--tinta-2)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      {fechaHora(s.inicia_at)}
                      <div>→ {fechaHora(s.finaliza_at)}</div>
                      {s.fecha_cierre_carga && (
                        <div style={{ color: 'var(--tinta-apagada)', fontSize: '0.8rem' }}>
                          Cerrado a mano: {fechaHora(s.fecha_cierre_carga)}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="acciones-fila">
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
                          <Link className="boton secundario chico" to={`/admin/sorteos/${s.id}`}>
                            Ver ganadores
                          </Link>
                        )}
                      </div>
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
