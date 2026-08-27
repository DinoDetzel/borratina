import { useEffect, useRef, useState } from 'react';

import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import BotonCompartir from '../componentes/BotonCompartir.jsx';
import Comprobante from '../componentes/Comprobante.jsx';
import { Bolillas, Cargando, Chip, MensajeError, Vacio } from '../componentes/comunes.jsx';
import { cuantoFalta, fechaHora, numero, periodoLargo, pesos } from '../utilidades.js';

const VACIO = ['', '', '', ''];

/** Cuántas jugadas recientes se listan abajo del formulario. */
const ULTIMAS = 15;

/**
 * Pantalla del vendedor: deliberadamente simple.
 * Formulario de carga + sus propias jugadas. Sin estadísticas ni gráficos:
 * eso es del panel del admin.
 *
 * El admin usa la misma pantalla y el backend no le filtra las jugadas ajenas,
 * así que acá elige explícitamente qué está mirando: lo suyo o todo. Antes decía
 * "Mis jugadas" y listaba las de todos, que es peor que no decir nada.
 */
export default function Vendedor() {
  const { usuario, esAdmin } = useAuth();
  const [sorteo, setSorteo] = useState(null);
  const [cargandoSorteo, setCargandoSorteo] = useState(true);
  const [sinSorteo, setSinSorteo] = useState('');

  const [numeros, setNumeros] = useState(VACIO);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [ultimo, setUltimo] = useState(null); // comprobante recién emitido

  const [avisoCompartir, setAvisoCompartir] = useState(null);

  // El de la lista va aparte del de arriba: son dos envíos distintos y mezclarlos
  // dejaría el aviso de uno colgado abajo del otro.
  const [avisoLista, setAvisoLista] = useState(null);

  // Para llevar la pantalla al comprobante apenas se emite: en el teléfono el
  // comprobante queda abajo del formulario y, sin esto, hay que scrollear a
  // mano justo cuando el comprador está esperando el ticket.
  const ticket = useRef(null);

  const [jugadas, setJugadas] = useState([]);
  const [totalJugadas, setTotalJugadas] = useState(0);
  const [cargandoJugadas, setCargandoJugadas] = useState(true);

  // Solo el admin puede cambiarlo: al vendedor el backend le da lo suyo y
  // punto, así que ofrecerle la opción sería mentirle.
  const [ambito, setAmbito] = useState('mias');
  const viendoTodas = esAdmin && ambito === 'todas';

  async function traerSorteo() {
    try {
      const { sorteo } = await api.sorteos.actual();
      setSorteo(sorteo);
      setSinSorteo('');
    } catch (err) {
      setSinSorteo(err.message);
    } finally {
      setCargandoSorteo(false);
    }
  }

  async function traerJugadas(cuales = ambito) {
    setCargandoJugadas(true);
    try {
      // Solo las últimas: sobre el final del mes un vendedor tiene cientos
      // cargadas y la pantalla se vuelve un scroll interminable. Para buscar
      // una vieja está el comprobante.
      //
      // Para el vendedor el `vendedor_id` sobra (el backend le impone el suyo);
      // para el admin es lo que hace la diferencia entre "mías" y "todas".
      const { jugadas, total } = await api.jugadas.listar({
        limit: ULTIMAS,
        vendedor_id: cuales === 'mias' ? usuario.id : undefined,
      });
      setJugadas(jugadas);
      setTotalJugadas(total);
    } catch {
      // El listado es secundario: si falla, no bloqueamos la carga de jugadas.
      setJugadas([]);
      setTotalJugadas(0);
    } finally {
      setCargandoJugadas(false);
    }
  }

  function cambiarAmbito(cuales) {
    setAmbito(cuales);
    traerJugadas(cuales);
  }

  useEffect(() => {
    traerSorteo();
    traerJugadas();
    // Solo al montar: después se refresca al cargar una jugada o al cambiar de
    // ámbito, que llaman a traerJugadas() a mano.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cambiarNumero(indice, valor) {
    // Solo dígitos y como mucho dos: el campo no deja escribir algo inválido.
    const limpio = valor.replace(/\D/g, '').slice(0, 2);
    setNumeros((previos) => previos.map((n, i) => (i === indice ? limpio : n)));

    // Al completar dos dígitos saltamos al siguiente campo: cargar de a muchas
    // jugadas seguidas es lo que más hace un vendedor.
    if (limpio.length === 2 && indice < 3) {
      document.getElementById(`numero-${indice + 1}`)?.focus();
    }
  }

  async function enviar(evento) {
    evento.preventDefault();
    setError('');

    if (numeros.some((n) => n === '')) {
      setError('Completá los 4 números.');
      return;
    }

    setEnviando(true);
    try {
      const { comprobante } = await api.jugadas.cargar({
        numeros: numeros.map(Number),
        comprador_nombre: nombre,
        comprador_telefono: telefono || null,
      });

      setUltimo(comprobante);
      setNumeros(VACIO);
      setNombre('');
      setTelefono('');
      // Acá no se enfoca el primer número: enfocar arrastra la pantalla de
      // vuelta al formulario y deja el comprobante abajo, justo cuando lo que
      // sigue es mandarlo. El foco vuelve al cerrarlo.

      traerJugadas();
      traerSorteo(); // cambió el conteo de jugadas
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  // `nearest` scrollea lo mínimo necesario: en el teléfono sube el comprobante
  // a la vista, y en la computadora —donde ya está al lado del formulario— no
  // mueve nada.
  useEffect(() => {
    if (ultimo) ticket.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [ultimo]);

  /** Cerrar el comprobante es querer cargar otra: ahí sí vuelve el foco arriba. */
  function cerrarComprobante() {
    setUltimo(null);
    setAvisoCompartir(null);
    document.getElementById('numero-0')?.focus();
  }

  if (cargandoSorteo) return <Cargando />;

  if (sinSorteo) {
    return (
      <>
        <div className="encabezado-seccion">
          <h1>Cargar jugada</h1>
        </div>
        <div className="aviso">
          {sinSorteo} Esperá a que el administrador abra el sorteo del mes.
        </div>
      </>
    );
  }

  return (
    <>
      <div className="encabezado-seccion">
        <h1>Cargar jugada</h1>
        <Chip estado={sorteo.estado}>Sorteo {periodoLargo(sorteo.periodo)}</Chip>
      </div>

      {/* El pozo es el gancho de venta: tiene que verse, pero sin comerse la
          pantalla del teléfono. El precio va al lado y no debajo. */}
      <div className="tarjeta" style={{ marginBottom: '1rem' }}>
        <div className="etiqueta" style={{ color: 'var(--tinta-2)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Pozo de {periodoLargo(sorteo.periodo)}
        </div>
        <div className="pozo-vendedor">{pesos(sorteo.pozo)}</div>
        <div className="pie" style={{ color: 'var(--tinta-apagada)', fontSize: '0.85rem' }}>
          {pesos(sorteo.precio_jugada)} por jugada
        </div>
      </div>

      {/* La ventana de carga: el vendedor tiene que enterarse de que se le acaba
          el tiempo antes de completar el formulario, no cuando el backend lo
          rechaza. */}
      {/* Sin punto final en las fechas: el formato en español ya termina en "p. m." */}
      {sorteo.aun_no_empezo && (
        <div className="aviso">
          La carga todavía no está habilitada. Abre el <strong>{fechaHora(sorteo.inicia_at)}</strong>
        </div>
      )}
      {sorteo.ya_vencio && (
        <div className="error">
          La carga cerró el <strong>{fechaHora(sorteo.finaliza_at)}</strong> — ya no se pueden
          cargar jugadas para este sorteo.
        </div>
      )}
      {sorteo.carga_vigente && (
        <div className="aviso">
          La carga cierra el <strong>{fechaHora(sorteo.finaliza_at)}</strong>
          {cuantoFalta(sorteo.finaliza_at) && <> — faltan {cuantoFalta(sorteo.finaliza_at)}</>}
        </div>
      )}

      {/* El formulario va antes que cualquier métrica: el vendedor entra a
          cargar, no a mirar números. En el teléfono, dejarlo abajo obligaba a
          scrollear para hacer lo único que vino a hacer. */}
      <div className="carga-y-ticket">
        <form className="tarjeta" onSubmit={enviar}>
          <h2 style={{ marginBottom: '1rem' }}>Nueva jugada</h2>

          <MensajeError>{error}</MensajeError>

          <div className="campo">
            <label>Números (00 a 99)</label>
            <div className="numeros">
              {numeros.map((valor, i) => (
                <input
                  key={i}
                  id={`numero-${i}`}
                  inputMode="numeric"
                  value={valor}
                  onChange={(e) => cambiarNumero(i, e.target.value)}
                  placeholder="00"
                  aria-label={`Número ${i + 1}`}
                  required
                />
              ))}
            </div>
            <div className="pie" style={{ color: 'var(--tinta-apagada)', fontSize: '0.8rem', marginTop: '0.35rem' }}>
              El orden no importa: se ordenan solos al guardarse.
            </div>
          </div>

          <div className="campo">
            <label htmlFor="nombre">Nombre del comprador</label>
            <input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
          </div>

          <div className="campo">
            <label htmlFor="telefono">Teléfono (opcional)</label>
            {/* `type="tel"` para que el teléfono abra el teclado numérico y no
                el de letras: se cargan jugadas de a muchas y parado en la calle.
                No valida ni formatea nada — se guarda tal cual se escribe. */}
            <input
              id="telefono"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="boton-cargar"
            disabled={enviando || !sorteo.carga_vigente}
            style={{ marginTop: '1.1rem' }}
          >
            {enviando
              ? 'Cargando…'
              : sorteo.carga_vigente
                ? 'Cargar y emitir comprobante'
                : 'Carga no habilitada'}
          </button>

          {/* Lo que lleva cargado quien está usando la pantalla. El total del
              sorteo lo manda el backend solo si es admin: a un vendedor no se
              le cuenta cuánto vendieron los demás. */}
          <div
            style={{ marginTop: '1.1rem', paddingTop: '0.9rem', borderTop: '1px solid var(--linea)' }}
          >
            {/* Con los totales del sorteo son cuatro cifras que se comparan de
                a pares, y escritas como frases sueltas no entraban en la
                columna del formulario: "Recaudado en total" terminaba con el
                importe en el renglón de abajo, lejos del recaudado propio. En
                columnas cada cifra queda debajo de la suya. */}
            {esAdmin ? (
              <table className="resumen-carga">
                <thead>
                  <tr>
                    <th></th>
                    <th>Cargadas</th>
                    <th>Recaudado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Vos</th>
                    <td>{numero(sorteo.mis_jugadas)}</td>
                    <td>{pesos(sorteo.mis_jugadas * sorteo.precio_jugada)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Todos</th>
                    <td>{numero(sorteo.jugadas_cargadas)}</td>
                    <td>{pesos(sorteo.recaudacion)}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              /* Al vendedor no se le cuenta lo de los demás: son dos datos
                 sueltos y una tabla de una fila sería puro adorno. */
              <div className="mis-datos">
                <span>
                  Cargadas por vos: <strong>{numero(sorteo.mis_jugadas)}</strong>
                </span>
                <span>
                  Recaudado: <strong>{pesos(sorteo.mis_jugadas * sorteo.precio_jugada)}</strong>
                </span>
              </div>
            )}
          </div>
        </form>

        {ultimo && (
          <div className="columna-comprobante" ref={ticket}>
            <Comprobante comprobante={ultimo} />

            {/* Una sola acción: mandarlo. El vendedor está en la calle con el
                teléfono, no al lado de una impresora — y para imprimir en la
                sede sigue estando Ctrl+P, que sale igual de bien. */}
            <div className="acciones-comprobante">
              <BotonCompartir comprobante={ultimo} onAviso={setAvisoCompartir} />
              <button className="enlace" onClick={cerrarComprobante}>
                Cerrar
              </button>
            </div>

            <p className="pie-comprobante">
              {avisoCompartir ??
                'Se abre la lista de apps del teléfono: elegí WhatsApp y después el contacto. Va la foto del comprobante.'}
            </p>
          </div>
        )}
      </div>

      <div className="tarjeta" style={{ marginTop: '1.5rem' }}>
        <div className="encabezado-tarjeta">
          <h2 style={{ margin: 0 }}>
            {viendoTodas ? 'Jugadas de este sorteo' : 'Mis jugadas de este sorteo'}
          </h2>

          {/* El admin ve las de todos si quiere, pero el título tiene que decir
              cuál de las dos cosas está mirando. */}
          {esAdmin && (
            <div className="acciones-fila">
              <button
                className={ambito === 'mias' ? 'chico' : 'secundario chico'}
                onClick={() => cambiarAmbito('mias')}
              >
                Mías
              </button>
              <button
                className={ambito === 'todas' ? 'chico' : 'secundario chico'}
                onClick={() => cambiarAmbito('todas')}
              >
                De todos
              </button>
            </div>
          )}
        </div>

        <p style={{ color: 'var(--tinta-2)', fontSize: '0.85rem', margin: '0.35rem 0 0.9rem' }}>
          {totalJugadas > ULTIMAS
            ? `Las ${ULTIMAS} más recientes de ${numero(totalJugadas)} ${
                viendoTodas ? 'que se cargaron' : 'que cargaste'
              }.`
            : `${numero(totalJugadas)} en total.`}
        </p>

        {avisoLista && <div className="aviso">{avisoLista}</div>}

        {cargandoJugadas ? (
          <Cargando />
        ) : jugadas.length === 0 ? (
          <Vacio>
            {viendoTodas
              ? 'Todavía no se cargó ninguna jugada en este sorteo.'
              : 'Todavía no cargaste ninguna jugada.'}
          </Vacio>
        ) : (
          <div className="tabla-scroll">
            <table className="tabla-a-lista">
              <thead>
                <tr>
                  <th>Comprobante</th>
                  <th>Números</th>
                  <th>Comprador</th>
                  {viendoTodas && <th>Vendedor</th>}
                  <th>Cargada</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {jugadas.map((j) => (
                  <tr key={j.id}>
                    <td className="codigo">{j.codigo}</td>
                    <td>
                      <Bolillas
                        numeros={[j.numero_1, j.numero_2, j.numero_3, j.numero_4]}
                      />
                    </td>
                    <td>
                      {j.comprador_nombre}
                      {j.comprador_telefono && (
                        <div style={{ color: 'var(--tinta-apagada)', fontSize: '0.82rem' }}>
                          {j.comprador_telefono}
                        </div>
                      )}
                    </td>
                    {viendoTodas && <td data-movil="Cargó">{j.vendedor}</td>}
                    <td style={{ color: 'var(--tinta-2)', fontSize: '0.85rem' }}>
                      {fechaHora(j.created_at)}
                    </td>
                    <td>
                      {/* Para cuando el comprobante quedó sin mandar: se cerró la
                          pantalla, se cortó el teléfono, el comprador dio mal el
                          número. Sale el mismo comprobante, no uno nuevo. */}
                      <div className="acciones-fila">
                        <BotonCompartir
                          codigo={j.codigo}
                          className="enlace"
                          onAviso={setAvisoLista}
                        >
                          Enviar
                        </BotonCompartir>
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
