import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../api.js';
import GraficoVentas from '../componentes/GraficoVentas.jsx';
import { Bolillas, Cargando, Chip, MensajeError, Ficha, Vacio } from '../componentes/comunes.jsx';
import { numero, periodoLargo, pesos } from '../utilidades.js';

/**
 * Cuántos vendedores entran en la tarjeta del panel.
 *
 * Es un podio, no una lista: con más, la tarjeta le saca altura al gráfico que
 * tiene al lado y hay que hacer scroll para leer el resto del panel. La lista
 * completa está en /admin/vendedores.
 */
const EN_EL_PANEL = 5;

export default function AdminDashboard() {
  const [sorteos, setSorteos] = useState([]);
  const [sorteoId, setSorteoId] = useState('');

  const [resumen, setResumen] = useState(null);
  const [vendedores, setVendedores] = useState([]);
  const [serie, setSerie] = useState([]);
  const [historial, setHistorial] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  // El sorteo elegido acota el resumen, la tabla por vendedor y el gráfico.
  // El historial es de todos los sorteos, así que no depende del filtro.
  useEffect(() => {
    let vigente = true;

    setError('');
    Promise.all([
      api.dashboard.resumen(sorteoId),
      api.dashboard.porVendedor(sorteoId),
      api.dashboard.ventas(sorteoId),
      api.dashboard.historial(),
      api.sorteos.listar(),
    ])
      .then(([r, v, s, h, ls]) => {
        if (!vigente) return;
        setResumen(r.resumen);
        setVendedores(v.vendedores);
        setSerie(s.serie);
        setHistorial(h.historial);
        setSorteos(ls.sorteos);
        // Sin filtro explícito, el backend eligió uno: lo reflejamos en el selector.
        if (!sorteoId && r.resumen?.id) setSorteoId(String(r.resumen.id));
      })
      .catch((err) => vigente && setError(err.message))
      .finally(() => vigente && setCargando(false));

    return () => {
      vigente = false;
    };
  }, [sorteoId]);

  if (cargando) return <Cargando />;

  if (error && !resumen) {
    return (
      <>
        <div className="encabezado-seccion">
          <h1>Panel</h1>
        </div>
        <div className="aviso">{error}</div>
      </>
    );
  }

  const finalizado = resumen.estado === 'finalizado';
  const cubierto = resumen.resultado >= 0;
  // Cuánto del pozo cubre lo recaudado. Se corta en 1: la barra llena ya dice
  // "cubierto", y el excedente lo cuenta el texto de abajo.
  const avance = resumen.pozo > 0 ? Math.min(1, resumen.recaudacion / resumen.pozo) : 0;
  const masCargo = Math.max(...vendedores.map((v) => Number(v.cantidad_jugadas)), 1);

  return (
    <>
      <div className="encabezado-seccion">
        <h1>Panel</h1>
        <Chip estado={resumen.estado}>{resumen.estado}</Chip>

        {/* El filtro va en el encabezado y no en una tarjeta propia: ocupaba un
            renglón entero para un solo control. */}
        <div style={{ marginLeft: 'auto' }}>
          <label htmlFor="sorteo" className="visualmente-oculto">
            Sorteo
          </label>
          <select
            id="sorteo"
            value={sorteoId}
            onChange={(e) => setSorteoId(e.target.value)}
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

      {/* El pozo es la cifra que encabeza el panel, y al lado va lo único que
          hace falta saber sobre él: si lo vendido alcanza para pagarlo. Van
          juntos porque solo se entienden uno contra el otro. */}
      <div className="tarjeta partida panel-hero" style={{ marginBottom: '1rem' }}>
        <div>
          <div className="etiqueta">{finalizado ? 'Pozo repartido' : 'Pozo'}</div>
          <div className="hero">{pesos(resumen.pozo)}</div>
          <div className="pie">
            {periodoLargo(resumen.periodo)} · {pesos(resumen.precio_jugada)} por jugada
          </div>

          {finalizado && resumen.numeros && (
            <div style={{ marginTop: '1.1rem' }}>
              <div className="etiqueta" style={{ marginBottom: '0.4rem' }}>
                Extracto
              </div>
              <Bolillas numeros={resumen.numeros} />
            </div>
          )}
        </div>

        <div className="cobertura">
          <div className="etiqueta">Recaudado</div>
          <div className="monto">{pesos(resumen.recaudacion)}</div>

          <div className={`barra ${cubierto ? 'cubierta' : ''}`}>
            <div className="relleno" style={{ width: `${Math.round(avance * 100)}%` }} />
          </div>

          <p className="pie" style={{ margin: '0.5rem 0 0' }}>
            {resumen.resultado === 0 ? (
              <>Lo recaudado cubre el pozo justo</>
            ) : cubierto ? (
              <>
                Cubre el pozo y sobran <strong>{pesos(resumen.resultado)}</strong>
              </>
            ) : (
              <>
                Falta <strong>{pesos(-resumen.resultado)}</strong> —{' '}
                {numero(resumen.jugadas_para_cubrir - resumen.jugadas_validas)} jugadas más
              </>
            )}
          </p>
        </div>
      </div>

      <div className="grilla" style={{ marginBottom: '1rem' }}>
        {/* El total cargado entre todos los vendedores. Es el número que el
            vendedor no ve en su pantalla: allá cada uno ve solo lo suyo. */}
        <Ficha
          etiqueta="Jugadas cargadas"
          valor={numero(resumen.jugadas_validas)}
          pie={`Entre ${numero(resumen.vendedores_activos)} vendedores`}
        />
        <Ficha
          etiqueta="Para cubrir el pozo"
          valor={numero(resumen.jugadas_para_cubrir)}
          pie={`A ${pesos(resumen.precio_jugada)} cada una`}
        />
        <Ficha
          etiqueta="Jugadas anuladas"
          valor={numero(resumen.jugadas_anuladas)}
          pie={resumen.jugadas_anuladas > 0 ? 'No cuentan para el sorteo' : 'Ninguna'}
        />
      </div>

      {/* La evolución y el reparto por vendedor contestan la misma pregunta
          desde dos lados, así que se leen de una sola pasada. */}
      <div className="panel-fila" style={{ marginBottom: '1rem' }}>
        <div className="tarjeta">
          <h2>Evolución de ventas</h2>
          <p style={{ color: 'var(--tinta-2)', fontSize: '0.85rem', margin: '0.2rem 0 0.75rem' }}>
            Jugadas cargadas por día en {periodoLargo(resumen.periodo)}.
          </p>
          <GraficoVentas serie={serie} />
        </div>

        <div className="tarjeta">
          <div className="encabezado-tarjeta">
            <h2 style={{ margin: 0 }}>Por vendedor</h2>
            {/* La tarjeta muestra el podio y nada más. Quién no vendió es una
                pregunta distinta, y se contesta del otro lado del enlace. */}
            <Link to={`/admin/vendedores${sorteoId ? `?sorteo=${sorteoId}` : ''}`}>
              Ver todos →
            </Link>
          </div>
          <p style={{ color: 'var(--tinta-2)', fontSize: '0.85rem', margin: '0 0 0.9rem' }}>
            Jugadas cargadas, de mayor a menor.
          </p>

          {vendedores.length === 0 ? (
            <Vacio>Nadie cargó jugadas en este sorteo.</Vacio>
          ) : (
            <ol className="ranking">
              {vendedores.slice(0, EN_EL_PANEL).map((v) => (
                <li key={v.id}>
                  <div className="linea">
                    <span>{v.nombre}</span>
                    <strong>{numero(v.cantidad_jugadas)}</strong>
                  </div>
                  {/* La barra se mide contra el que más cargó, no contra el
                      total: lo que se compara acá es entre vendedores. */}
                  <div className="barra">
                    <div
                      className="relleno"
                      style={{ width: `${(v.cantidad_jugadas / masCargo) * 100}%` }}
                    />
                  </div>
                  <div className="pie">{pesos(v.recaudacion)}</div>
                </li>
              ))}
            </ol>
          )}

          {vendedores.length > EN_EL_PANEL && (
            <p style={{ color: 'var(--tinta-apagada)', fontSize: '0.82rem', margin: '0.9rem 0 0' }}>
              Y {numero(vendedores.length - EN_EL_PANEL)} más.
            </p>
          )}
        </div>
      </div>

      <div className="tarjeta">
        <h2 style={{ marginBottom: '0.75rem' }}>Historial de sorteos</h2>
        {historial.length === 0 ? (
          <Vacio>Todavía no hay sorteos finalizados.</Vacio>
        ) : (
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th>Período</th>
                  {/* Los 20 números no entran en un teléfono sin volver la fila
                      altísima. Están en el detalle del sorteo, a un toque. */}
                  <th className="oculta-en-movil">Resultado</th>
                  <th style={{ textAlign: 'right' }}>Pozo</th>
                  <th style={{ textAlign: 'right' }}>Recaudado</th>
                  <th style={{ textAlign: 'right' }}>Ganadores</th>
                  <th style={{ textAlign: 'right' }}>Premio c/u</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((h) => (
                  <tr key={h.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <Link to={`/admin/sorteos/${h.id}`}>{periodoLargo(h.periodo)}</Link>
                    </td>
                    <td className="oculta-en-movil">
                      <Bolillas numeros={h.numeros} compactas />
                    </td>
                    <td className="num">{pesos(h.pozo)}</td>
                    <td className="num">
                      {pesos(h.recaudacion)}
                      <div style={{ color: 'var(--tinta-apagada)', fontSize: '0.78rem' }}>
                        {h.resultado >= 0 ? '+' : '−'}
                        {pesos(Math.abs(h.resultado)).replace('$', '').trim()}
                      </div>
                    </td>
                    <td className="num">
                      {h.vacante ? <Chip estado="cerrado">Vacante</Chip> : numero(h.cantidad_ganadores)}
                    </td>
                    <td className="num">{h.vacante ? '—' : pesos(h.premio_por_ganador)}</td>
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
