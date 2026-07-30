import { useEffect, useState } from 'react';

import { api } from '../api.js';
import Comprobante from '../componentes/Comprobante.jsx';
import { Bolillas, Cargando, Chip, MensajeError, Ficha, Vacio } from '../componentes/comunes.jsx';
import { fechaHora, periodoLargo, pesos } from '../utilidades.js';

const VACIO = ['', '', '', ''];

/** Cuántas jugadas recientes se listan abajo del formulario. */
const ULTIMAS = 15;

/**
 * Pantalla del vendedor: deliberadamente simple.
 * Formulario de carga + sus propias jugadas. Sin estadísticas ni gráficos:
 * eso es del panel del admin.
 */
export default function Vendedor() {
  const [sorteo, setSorteo] = useState(null);
  const [cargandoSorteo, setCargandoSorteo] = useState(true);
  const [sinSorteo, setSinSorteo] = useState('');

  const [numeros, setNumeros] = useState(VACIO);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [ultimo, setUltimo] = useState(null); // comprobante recién emitido

  const [jugadas, setJugadas] = useState([]);
  const [totalJugadas, setTotalJugadas] = useState(0);
  const [cargandoJugadas, setCargandoJugadas] = useState(true);

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

  async function traerJugadas() {
    setCargandoJugadas(true);
    try {
      // Solo las últimas: sobre el final del mes un vendedor tiene cientos
      // cargadas y la pantalla se vuelve un scroll interminable. Para buscar
      // una vieja está el comprobante.
      const { jugadas, total } = await api.jugadas.listar({ limit: ULTIMAS });
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

  useEffect(() => {
    traerSorteo();
    traerJugadas();
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
      traerSorteo(); // el pozo cambió
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
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

      <div className="grilla" style={{ marginBottom: '1rem' }}>
        <Ficha etiqueta="Pozo acumulado" valor={pesos(sorteo.pozo_actual)} />
        <Ficha
          etiqueta="Jugadas cargadas"
          valor={sorteo.jugadas_cargadas}
          pie={`${pesos(sorteo.precio_jugada)} por jugada`}
        />
      </div>

      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'minmax(280px, 1fr) auto' }}>
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

          <button type="submit" disabled={enviando} style={{ marginTop: '1.1rem' }}>
            {enviando ? 'Cargando…' : 'Cargar y emitir comprobante'}
          </button>
        </form>

        {ultimo && (
          <div>
            <Comprobante comprobante={ultimo} />
            <div className="no-imprimir" style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button className="secundario chico" onClick={() => window.print()}>
                Imprimir
              </button>
              <button className="secundario chico" onClick={() => setUltimo(null)}>
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="tarjeta no-imprimir" style={{ marginTop: '1.5rem' }}>
        <h2 style={{ marginBottom: '0.2rem' }}>Mis jugadas de este sorteo</h2>
        <p style={{ color: 'var(--tinta-2)', fontSize: '0.85rem', margin: '0 0 0.9rem' }}>
          {totalJugadas > ULTIMAS
            ? `Las ${ULTIMAS} más recientes de ${totalJugadas} que cargaste.`
            : `${totalJugadas} en total.`}
        </p>

        {cargandoJugadas ? (
          <Cargando />
        ) : jugadas.length === 0 ? (
          <Vacio>Todavía no cargaste ninguna jugada.</Vacio>
        ) : (
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th>Comprobante</th>
                  <th>Números</th>
                  <th>Comprador</th>
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
