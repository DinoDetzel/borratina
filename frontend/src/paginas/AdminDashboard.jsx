import { useEffect, useState } from 'react';

import { api } from '../api.js';
import GraficoVentas from '../componentes/GraficoVentas.jsx';
import { Bolillas, Cargando, Chip, MensajeError, Ficha, Vacio } from '../componentes/comunes.jsx';
import { numero, periodoLargo, pesos } from '../utilidades.js';

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

  return (
    <>
      <div className="encabezado-seccion">
        <h1>Panel</h1>
        <Chip estado={resumen.estado}>{resumen.estado}</Chip>
      </div>

      <MensajeError>{error}</MensajeError>

      {/* Un solo control de filtro arriba de todo lo que acota. */}
      <div className="tarjeta" style={{ marginBottom: '1rem' }}>
        <label htmlFor="sorteo">Sorteo</label>
        <select id="sorteo" value={sorteoId} onChange={(e) => setSorteoId(e.target.value)}>
          {sorteos.map((s) => (
            <option key={s.id} value={s.id}>
              {periodoLargo(s.periodo)} — {s.estado}
            </option>
          ))}
        </select>
      </div>

      {/* La cifra que encabeza el panel: el premio comprometido. */}
      <div className="tarjeta" style={{ marginBottom: '1rem' }}>
        <div className="etiqueta" style={{ color: 'var(--tinta-2)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {finalizado ? 'Pozo repartido' : 'Pozo'}
        </div>
        <div className="hero">{pesos(resumen.pozo)}</div>
        <div className="pie" style={{ color: 'var(--tinta-apagada)', fontSize: '0.85rem' }}>
          {periodoLargo(resumen.periodo)} · {pesos(resumen.precio_jugada)} por jugada
        </div>
      </div>

      {/* El pozo es fijo, así que lo que importa es si lo que se vende alcanza
          para cubrirlo. Esa diferencia es el número que dice cómo va el sorteo. */}
      <div className="grilla" style={{ marginBottom: '1rem' }}>
        <Ficha
          etiqueta="Recaudado"
          valor={pesos(resumen.recaudacion)}
          pie={`${numero(resumen.jugadas_validas)} jugadas vendidas`}
        />
        <Ficha
          etiqueta={resumen.resultado >= 0 ? 'Ganancia' : 'Falta para cubrir el pozo'}
          valor={pesos(Math.abs(resumen.resultado))}
          pie={
            resumen.resultado >= 0
              ? 'La recaudación cubre el premio'
              : `Faltan ${numero(resumen.jugadas_para_cubrir - resumen.jugadas_validas)} jugadas`
          }
        />
        <Ficha etiqueta="Vendedores activos" valor={numero(resumen.vendedores_activos)} />
        <Ficha
          etiqueta="Jugadas anuladas"
          valor={numero(resumen.jugadas_anuladas)}
          pie={resumen.jugadas_anuladas > 0 ? 'No cuentan para el sorteo' : null}
        />
      </div>

      {finalizado && (
        <div className="tarjeta" style={{ marginBottom: '1rem' }}>
          <h2 style={{ marginBottom: '0.6rem' }}>Resultado del sorteo</h2>
          <Bolillas
            numeros={[resumen.numero_1, resumen.numero_2, resumen.numero_3, resumen.numero_4]}
          />
        </div>
      )}

      <div className="tarjeta" style={{ marginBottom: '1rem' }}>
        <h2>Evolución de ventas</h2>
        <p style={{ color: 'var(--tinta-2)', fontSize: '0.85rem', margin: '0.2rem 0 0.75rem' }}>
          Jugadas cargadas por día en {periodoLargo(resumen.periodo)}.
        </p>
        <GraficoVentas serie={serie} />
      </div>

      <div className="tarjeta" style={{ marginBottom: '1rem' }}>
        <h2 style={{ marginBottom: '0.75rem' }}>Por vendedor</h2>
        {vendedores.length === 0 ? (
          <Vacio>Nadie cargó jugadas en este sorteo.</Vacio>
        ) : (
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th>Vendedor</th>
                  <th style={{ textAlign: 'right' }}>Jugadas</th>
                  <th style={{ textAlign: 'right' }}>Recaudación</th>
                </tr>
              </thead>
              <tbody>
                {vendedores.map((v) => (
                  <tr key={v.id}>
                    <td>
                      {v.nombre}
                      <div style={{ color: 'var(--tinta-apagada)', fontSize: '0.8rem' }}>
                        {v.usuario}
                      </div>
                    </td>
                    <td className="num">{numero(v.cantidad_jugadas)}</td>
                    <td className="num">{pesos(v.recaudacion)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
                  <th>Resultado</th>
                  <th style={{ textAlign: 'right' }}>Pozo</th>
                  <th style={{ textAlign: 'right' }}>Recaudado</th>
                  <th style={{ textAlign: 'right' }}>Ganadores</th>
                  <th style={{ textAlign: 'right' }}>Premio c/u</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((h) => (
                  <tr key={h.id}>
                    <td>{periodoLargo(h.periodo)}</td>
                    <td>
                      <Bolillas numeros={[h.numero_1, h.numero_2, h.numero_3, h.numero_4]} />
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
