import { useEffect, useState } from 'react';

import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Comprobante from '../componentes/Comprobante.jsx';
import { compartirComprobante, enlaceWhatsapp, numeroWhatsapp } from '../whatsapp.js';
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

  // Dibujar el comprobante y armar el PNG tarda un instante en un teléfono
  // modesto: mientras tanto el botón lo dice, para que nadie lo toque dos veces.
  const [compartiendo, setCompartiendo] = useState(false);
  const [avisoCompartir, setAvisoCompartir] = useState(null);

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
      document.getElementById('numero-0')?.focus();

      traerJugadas();
      traerSorteo(); // cambió el conteo de jugadas
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function compartirFoto() {
    setCompartiendo(true);
    setAvisoCompartir(null);
    try {
      const resultado = await compartirComprobante(ultimo);
      if (resultado === 'descargado') {
        setAvisoCompartir(
          'Este navegador no comparte archivos, así que el comprobante se descargó. ' +
            'Adjuntalo desde WhatsApp.',
        );
      }
    } catch {
      setAvisoCompartir('No se pudo preparar la foto. Probá con el texto o imprimilo.');
    } finally {
      setCompartiendo(false);
    }
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
            <input id="telefono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
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
            <div className="mis-datos">
              <span>
                Cargadas por vos: <strong>{numero(sorteo.mis_jugadas)}</strong>
              </span>
              <span>
                Recaudado: <strong>{pesos(sorteo.mis_jugadas * sorteo.precio_jugada)}</strong>
              </span>
            </div>

            {esAdmin && (
              <div className="mis-datos" style={{ marginTop: '0.35rem' }}>
                <span>
                  Cargadas en total: <strong>{numero(sorteo.jugadas_cargadas)}</strong>
                </span>
                <span>
                  Recaudado en total: <strong>{pesos(sorteo.recaudacion)}</strong>
                </span>
              </div>
            )}
          </div>
        </form>

        {ultimo && (
          <div>
            <Comprobante comprobante={ultimo} />

            {/* Mandarlo va primero que imprimirlo: el vendedor está en la calle
                con el teléfono, no al lado de una impresora. */}
            <div className="no-imprimir acciones-comprobante">
              <button onClick={compartirFoto} disabled={compartiendo}>
                {compartiendo ? 'Preparando…' : 'Enviar la foto'}
              </button>
              <a
                className="boton secundario"
                href={enlaceWhatsapp(ultimo)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Enviar el texto
              </a>
              <button className="secundario" onClick={() => window.print()}>
                Imprimir
              </button>
              <button className="enlace" onClick={() => setUltimo(null)}>
                Cerrar
              </button>
            </div>

            {/* Cada camino tiene su costo y conviene decirlo: la foto se ve
                mejor pero el contacto lo elegís vos; el texto va derecho al chat
                del comprador y le deja el código buscable. */}
            <p className="no-imprimir pie-comprobante">
              {avisoCompartir ?? (
                <>
                  <strong>La foto</strong> se manda por donde elijas y ahí elegís el contacto.{' '}
                  <strong>El texto</strong>{' '}
                  {numeroWhatsapp(ultimo.comprador.telefono)
                    ? `abre directo el chat con ${ultimo.comprador.telefono}`
                    : 'abre WhatsApp para que elijas el contacto'}
                  , y le deja el número de comprobante para que después lo pueda buscar.
                </>
              )}
            </p>
          </div>
        )}
      </div>

      <div className="tarjeta no-imprimir" style={{ marginTop: '1.5rem' }}>
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
