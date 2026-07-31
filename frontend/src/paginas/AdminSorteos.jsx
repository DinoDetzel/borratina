import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { api } from '../api.js';
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
              <div>
                <label htmlFor="inicia">La carga abre</label>
                <input
                  id="inicia"
                  type="datetime-local"
                  value={inicia}
                  onChange={(e) => setInicia(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="finaliza">La carga cierra</label>
                <input
                  id="finaliza"
                  type="datetime-local"
                  value={finaliza}
                  onChange={(e) => setFinaliza(e.target.value)}
                  min={inicia}
                  required
                />
              </div>
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
        )}
      </div>

      {/* El pozo se puede corregir mientras la carga siga abierta. Después no:
          el premio ya se anunció con jugadas hechas. */}
      {abierto && (
        <div className="tarjeta">
          <h2 style={{ marginBottom: '0.4rem' }}>Pozo de {periodoLargo(abierto.periodo)}</h2>
          <p style={{ color: 'var(--tinta-2)', fontSize: '0.85rem', marginTop: 0 }}>
            Ahora es <strong>{pesos(abierto.pozo)}</strong>. Se puede cambiar mientras la carga
            esté abierta.
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

          <hr style={{ border: 'none', borderTop: '1px solid var(--linea)', margin: '1.25rem 0' }} />

          <h3 style={{ marginBottom: '0.3rem' }}>Fechas de carga</h3>
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
            <div>
              <label htmlFor="inicia-editado">La carga abre</label>
              <input
                id="inicia-editado"
                type="datetime-local"
                value={iniciaEditado}
                onChange={(e) => setIniciaEditado(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="finaliza-editado">La carga cierra</label>
              <input
                id="finaliza-editado"
                type="datetime-local"
                value={finalizaEditado}
                onChange={(e) => setFinalizaEditado(e.target.value)}
                min={iniciaEditado}
                required
              />
            </div>
            <div style={{ flex: '0 0 auto' }}>
              <button type="submit" className="secundario">
                Cambiar fechas
              </button>
            </div>
          </form>
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

          <div className="extracto">
            {resultado.map((valor, i) => (
              <input
                key={i}
                id={`extracto-${i}`}
                inputMode="numeric"
                value={valor}
                placeholder={String(i + 1)}
                aria-label={`Número ${i + 1} del extracto`}
                onChange={(e) => {
                  const limpio = e.target.value.replace(/\D/g, '').slice(0, 2);
                  setResultado((prev) => prev.map((n, j) => (j === i ? limpio : n)));
                  // Cargar 20 números a mano es tedioso: el foco salta solo.
                  if (limpio.length === 2 && i < CANTIDAD_EXTRACTO - 1) {
                    document.getElementById(`extracto-${i + 1}`)?.focus();
                  }
                }}
              />
            ))}
          </div>

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
            <table>
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Precio</th>
                  <th>Resultado</th>
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
                    <td className="num">{pesos(s.precio_jugada)}</td>
                    <td>
                      {s.numeros ? (
                        <Bolillas numeros={s.numeros} />
                      ) : (
                        <span style={{ color: 'var(--tinta-apagada)' }}>—</span>
                      )}
                    </td>
                    <td className="num">{pesos(s.pozo)}</td>
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
