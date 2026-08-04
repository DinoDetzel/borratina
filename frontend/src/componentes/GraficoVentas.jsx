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
 * Desde cuántos días con ventas la tabla pasa a agruparse por semana.
 *
 * Un sorteo es de un mes, así que día por día son treinta y pico de renglones:
 * en el teléfono hay que scrollear un rato para llegar al final. Por debajo de
 * este número la tabla entra de una y agrupar solo escondería datos.
 */
const DIAS_PARA_AGRUPAR = 8;

const MES_CORTO = new Intl.DateTimeFormat('es-AR', { month: 'short' });

/**
 * Junta la serie diaria en semanas del mes: 1–7, 8–14, 15–21, 22–28 y de 29 en
 * adelante, que absorbe el resto del mes.
 *
 * Se corta por número de día y no cada 7 días desde la primera venta, para que
 * las filas caigan siempre en las mismas fechas y dos sorteos se puedan comparar
 * renglón contra renglón. El año y el mes entran en la clave porque la ventana
 * de carga puede empezar antes del mes del sorteo.
 */
function porSemana(serie) {
  const grupos = new Map();

  for (const d of serie) {
    const [anio, mes, dia] = d.dia.split('-').map(Number);
    const clave = `${anio}-${mes}-${Math.min(Math.floor((dia - 1) / 7), 4)}`;

    const grupo = grupos.get(clave);
    if (!grupo) {
      grupos.set(clave, {
        clave,
        anio,
        mes,
        desde: dia,
        hasta: dia,
        jugadas: Number(d.jugadas_del_dia),
        recaudacion: Number(d.recaudacion_del_dia),
        acumuladas: Number(d.jugadas_acumuladas),
      });
      continue;
    }

    grupo.hasta = dia;
    grupo.jugadas += Number(d.jugadas_del_dia);
    grupo.recaudacion += Number(d.recaudacion_del_dia);
    // La serie viene ordenada por día, así que el último acumulado que se ve es
    // el que cierra la semana.
    grupo.acumuladas = Number(d.jugadas_acumuladas);
  }

  return [...grupos.values()];
}

/**
 * "8 – 14 ago", o "9 ago" si esa semana tuvo un solo día con ventas.
 *
 * Los extremos son los días que efectivamente vendieron, no el 1 y el 7 de la
 * semana: la fila dice qué pasó, y una semana que arrancó recién el jueves no
 * tiene por qué anunciarse desde el lunes.
 */
function rangoDeLaSemana(g) {
  const mes = MES_CORTO.format(new Date(g.anio, g.mes - 1, 1)).replace('.', '');
  return g.desde === g.hasta ? `${g.desde} ${mes}` : `${g.desde} – ${g.hasta} ${mes}`;
}

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

  // Con un solo día no hay evolución que mostrar: una línea necesita al menos
  // dos puntos, y un punto suelto en un plano vacío se lee peor que el número.
  if (serie.length === 1) {
    const [dia] = serie;
    return (
      <div className="ficha" style={{ paddingTop: '0.5rem' }}>
        <div className="valor">{numero(dia.jugadas_del_dia)}</div>
        <div className="pie">
          jugadas el {fechaCorta(dia.dia)} · {pesos(dia.recaudacion_del_dia)}
        </div>
        <div className="pie" style={{ marginTop: '0.6rem' }}>
          El gráfico aparece cuando haya ventas de más de un día.
        </div>
      </div>
    );
  }

  // Las dos formas de la tabla se arman iguales, así que el JSX es uno solo.
  const agrupada = serie.length >= DIAS_PARA_AGRUPAR;
  const filas = agrupada
    ? porSemana(serie).map((g) => ({
        clave: g.clave,
        etiqueta: rangoDeLaSemana(g),
        jugadas: g.jugadas,
        acumuladas: g.acumuladas,
        recaudacion: g.recaudacion,
      }))
    : serie.map((d) => ({
        clave: d.dia,
        etiqueta: fechaCorta(d.dia),
        jugadas: d.jugadas_del_dia,
        acumuladas: d.jugadas_acumuladas,
        recaudacion: d.recaudacion_del_dia,
      }));

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
        <button className="secundario chico" onClick={() => setVerTabla((v) => !v)}>
          {verTabla ? 'Ver gráfico' : 'Ver tabla'}
        </button>
      </div>

      {verTabla ? (
        <>
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th>{agrupada ? 'Semana' : 'Día'}</th>
                  <th style={{ textAlign: 'right' }}>Jugadas</th>
                  <th style={{ textAlign: 'right' }}>Acumuladas</th>
                  <th style={{ textAlign: 'right' }}>Recaudación</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.clave}>
                    <td style={{ whiteSpace: 'nowrap' }}>{f.etiqueta}</td>
                    <td className="num">{numero(f.jugadas)}</td>
                    <td className="num">{numero(f.acumuladas)}</td>
                    <td className="num">{pesos(f.recaudacion)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {agrupada && (
            <p style={{ color: 'var(--tinta-apagada)', fontSize: '0.8rem', margin: '0.7rem 0 0' }}>
              Agrupado por semana: el sorteo lleva {serie.length} días con ventas. El gráfico los
              muestra uno por uno.
            </p>
          )}
        </>
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
