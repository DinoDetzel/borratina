import { useState } from 'react';

import { api } from '../api.js';
import BotonCompartir from '../componentes/BotonCompartir.jsx';
import Comprobante from '../componentes/Comprobante.jsx';
import { Bolillas, Cargando, Chip, MensajeError, Vacio } from '../componentes/comunes.jsx';
import { aciertos, fechaDia, numero, periodoLargo, pesos } from '../utilidades.js';

/**
 * Consultar una jugada por el código del comprobante.
 *
 * Es la pantalla del mostrador: el comprador se presenta con el papel en la mano
 * y lo que hay que contestarle es si ganó y cuánto cobra. Hasta ahora eso solo se
 * podía averiguar desde el detalle del sorteo, que es del admin — el vendedor,
 * que es el que atiende, no tenía por dónde buscar.
 *
 * La visibilidad es la misma que en todo el resto: el vendedor solo encuentra las
 * jugadas que cargó él, el admin todas. Eso lo impone el backend, que responde
 * 404 en los dos casos para no confirmarle a un vendedor que el código existe
 * pero es ajeno.
 */
export default function ConsultarComprobante() {
  const [codigo, setCodigo] = useState('');
  const [resultado, setResultado] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState(null);

  async function buscar(evento) {
    evento.preventDefault();
    setError('');
    setAviso(null);
    setResultado(null);
    setBuscando(true);

    try {
      setResultado(await api.jugadas.porComprobante(codigo.trim()));
    } catch (err) {
      // El backend distingue el formato mal escrito (400) de la jugada que no
      // aparece (404), y los dos mensajes sirven tal cual: uno dice qué
      // carácter molesta, el otro que no existe.
      setError(err.message);
    } finally {
      setBuscando(false);
    }
  }

  return (
    <>
      <div className="encabezado-seccion">
        <h1>Consultar comprobante</h1>
      </div>

      <div className="tarjeta">
        <p style={{ color: 'var(--tinta-2)', fontSize: '0.85rem', margin: '0 0 0.9rem' }}>
          El código está abajo de todo en el papel. Da igual con guion o sin guion, y en
          minúsculas.
        </p>

        <form className="fila" onSubmit={buscar}>
          <div style={{ flex: 1 }}>
            <label htmlFor="codigo" className="visualmente-oculto">
              Código de comprobante
            </label>
            <input
              id="codigo"
              className="codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="260815-K7M3XQ"
              // La primera mitad son dígitos, así que en el teléfono conviene el
              // teclado numérico; las letras se alcanzan igual desde ahí.
              inputMode="numeric"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck="false"
              required
              autoFocus
            />
          </div>
          <div style={{ flex: '0 0 auto' }}>
            <button type="submit" disabled={buscando}>
              {buscando ? 'Buscando…' : 'Buscar'}
            </button>
          </div>
        </form>

        <MensajeError>{error}</MensajeError>
      </div>

      {buscando && <Cargando />}
      {!buscando && !resultado && !error && (
        <Vacio>Escribí un código para ver la jugada.</Vacio>
      )}

      {resultado && <Resultado {...resultado} onAviso={setAviso} aviso={aviso} />}
    </>
  );
}

/** Lo que hay que contestarle al que trajo el papel, antes que el papel mismo. */
function Resultado({ comprobante, sorteado, extracto, gano, cantidad_ganadores, premio, onAviso, aviso }) {
  const numeros = comprobante.numeros.map(Number);

  return (
    <>
      <div className="tarjeta">
        {/* Una anulada va primero y sola: no importa si los números coinciden,
            ese comprobante no cobra, y decirlo después del resultado sería
            darle una alegría a alguien para sacársela en el renglón siguiente. */}
        {comprobante.anulada ? (
          <>
            <div className="encabezado-tarjeta">
              <h2 style={{ margin: 0 }}>Comprobante anulado</h2>
              <Chip estado="anulada">Anulada</Chip>
            </div>
            <p style={{ color: 'var(--tinta-2)', margin: '0.5rem 0 0' }}>
              Esta jugada fue anulada, así que no participa del sorteo ni cobra premio, coincidan
              o no los números.
            </p>
          </>
        ) : !sorteado ? (
          <>
            <div className="encabezado-tarjeta">
              <h2 style={{ margin: 0 }}>Todavía no se sorteó</h2>
              <Chip estado={comprobante.sorteo.estado}>{comprobante.sorteo.estado}</Chip>
            </div>
            <p style={{ color: 'var(--tinta-2)', margin: '0.5rem 0 0' }}>
              El sorteo de {periodoLargo(comprobante.sorteo.periodo)} se juega el{' '}
              <strong>{fechaDia(comprobante.sorteo.sortea_el)}</strong>, por un pozo de{' '}
              <strong>{pesos(comprobante.sorteo.pozo)}</strong>.
            </p>
          </>
        ) : gano ? (
          <>
            <div className="encabezado-tarjeta">
              <h2 style={{ margin: 0 }}>Ganadora</h2>
              <Chip estado="gano">Cobra</Chip>
            </div>
            <div className="hero" style={{ marginTop: '0.4rem' }}>{pesos(premio)}</div>
            <p style={{ color: 'var(--tinta-2)', margin: '0.3rem 0 0' }}>
              {cantidad_ganadores === 1
                ? `Único ganador: se lleva el pozo entero de ${pesos(comprobante.sorteo.pozo)}.`
                : `El pozo de ${pesos(comprobante.sorteo.pozo)} se reparte entre ${numero(
                    cantidad_ganadores,
                  )} ganadores.`}
            </p>
            <p style={{ color: 'var(--tinta-apagada)', fontSize: '0.85rem', margin: '0.5rem 0 0' }}>
              El pago se arregla fuera del sistema: acá no queda registrado si se cobró.
            </p>
          </>
        ) : (
          <>
            <h2 style={{ margin: 0 }}>No ganó</h2>
            <p style={{ color: 'var(--tinta-2)', margin: '0.5rem 0 0' }}>
              Hacen falta los 4 números dentro del extracto. No hay premio por acertar 3.
            </p>
          </>
        )}

        {/* Los números van siempre, con los que salieron en verde: es lo que
            deja ver de un vistazo por qué no ganó, sin comparar contra veinte
            números a ojo. */}
        <div style={{ marginTop: '1.1rem' }}>
          <div className="etiqueta" style={{ marginBottom: '0.4rem' }}>
            {sorteado ? 'Sus números, en verde los que salieron' : 'Sus números'}
          </div>
          <Bolillas numeros={numeros} marcadas={aciertos(numeros, extracto)} />
        </div>

        {sorteado && extracto && (
          <div style={{ marginTop: '1.1rem' }}>
            <div className="etiqueta" style={{ marginBottom: '0.4rem' }}>
              Extracto del sorteo
            </div>
            <Bolillas numeros={extracto} compactas />
          </div>
        )}

        <div className="acciones-comprobante" style={{ marginTop: '1.2rem' }}>
          <BotonCompartir comprobante={comprobante} onAviso={(texto) => onAviso(texto)}>
            Reenviar comprobante
          </BotonCompartir>
        </div>
        {aviso && <p className="pie-comprobante">{aviso}</p>}
      </div>

      {/* El papel, abajo: sirve para cotejar contra el que trajo el comprador. */}
      <div className="columna-comprobante" style={{ marginTop: '1rem' }}>
        <Comprobante comprobante={comprobante} />
      </div>
    </>
  );
}
