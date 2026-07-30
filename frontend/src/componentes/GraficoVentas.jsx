import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Vacio } from './comunes.jsx';
import { fechaCorta, numero, pesos } from '../utilidades.js';

/**
 * Evolución de jugadas por día dentro de un sorteo.
 *
 * Una sola serie, así que no lleva leyenda: el título ya dice qué se grafica.
 * Se plotea solo la cantidad de jugadas; la recaudación es la misma serie
 * multiplicada por una constante, y meterla como segundo eje inventaría una
 * correlación que no existe. Va en el tooltip y en la tabla.
 */
export default function GraficoVentas({ serie }) {
  const [verTabla, setVerTabla] = useState(false);

  if (!serie || serie.length === 0) {
    return <Vacio>Todavía no hay jugadas cargadas en este sorteo.</Vacio>;
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
        <button className="secundario chico" onClick={() => setVerTabla((v) => !v)}>
          {verTabla ? 'Ver gráfico' : 'Ver tabla'}
        </button>
      </div>

      {verTabla ? (
        <div className="tabla-scroll">
          <table>
            <thead>
              <tr>
                <th>Día</th>
                <th style={{ textAlign: 'right' }}>Jugadas</th>
                <th style={{ textAlign: 'right' }}>Acumuladas</th>
                <th style={{ textAlign: 'right' }}>Recaudación</th>
              </tr>
            </thead>
            <tbody>
              {serie.map((d) => (
                <tr key={d.dia}>
                  <td>{fechaCorta(d.dia)}</td>
                  <td className="num">{numero(d.jugadas_del_dia)}</td>
                  <td className="num">{numero(d.jugadas_acumuladas)}</td>
                  <td className="num">{pesos(d.recaudacion_del_dia)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grafico-caja">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={serie} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
              {/* Grilla horizontal, hairline sólida y recesiva. */}
              <CartesianGrid stroke="var(--linea)" strokeWidth={1} vertical={false} />
              <XAxis
                dataKey="dia"
                tickFormatter={fechaCorta}
                tick={{ fill: 'var(--tinta-apagada)', fontSize: 12 }}
                stroke="var(--eje)"
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                width={36}
                tickCount={5}
                tick={{ fill: 'var(--tinta-apagada)', fontSize: 12 }}
                stroke="var(--eje)"
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={<TooltipVentas />}
                cursor={{ stroke: 'var(--eje)', strokeWidth: 1 }}
              />
              <Line
                type="monotone"
                dataKey="jugadas_del_dia"
                stroke="var(--serie-1)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                // Sin animación de entrada: Recharts la hace tapando el trazo con
                // un strokeDasharray, y hasta que termina la línea no se ve. En un
                // panel que se consulta de reojo, además, el barrido molesta.
                isAnimationActive={false}
                // El anillo del color de la superficie mantiene legible el punto
                // donde se cruza con la línea, y agranda el área de hover.
                dot={{ r: 4, fill: 'var(--serie-1)', stroke: 'var(--superficie)', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: 'var(--serie-1)', stroke: 'var(--superficie)', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  );
}

function TooltipVentas({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;

  return (
    <div className="tooltip">
      <div className="dia">{fechaCorta(d.dia)}</div>
      <div className="dato">
        <span className="punto" />
        {numero(d.jugadas_del_dia)} jugadas · {pesos(d.recaudacion_del_dia)}
      </div>
      <div className="dia" style={{ marginTop: '0.2rem' }}>
        {numero(d.jugadas_acumuladas)} acumuladas
      </div>
    </div>
  );
}
