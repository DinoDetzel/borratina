import { useState } from 'react';

import { useAuth } from '../auth.jsx';
import { MensajeError } from '../componentes/comunes.jsx';

/**
 * Cuánto se espera antes de avisar que el servidor puede estar despertando.
 *
 * El backend duerme cuando no tiene tráfico y el primer request del día tarda
 * hasta un minuto en levantarlo. Sin este aviso el botón se queda en
 * "Ingresando…" y la espera se lee como que la app se colgó: el vendedor
 * recarga, y con eso vuelve a empezar la cuenta.
 *
 * Seis segundos es bastante más que un login normal, así que en el uso de
 * todos los días el cartel no llega a aparecer.
 */
const AVISO_DE_ESPERA_MS = 6_000;

export default function Login() {
  const { iniciarSesion } = useAuth();

  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [despertando, setDespertando] = useState(false);

  async function enviar(evento) {
    evento.preventDefault();
    setError('');
    setEnviando(true);

    const aviso = setTimeout(() => setDespertando(true), AVISO_DE_ESPERA_MS);

    try {
      // El redirect lo resuelve App al cambiar el usuario del contexto.
      await iniciarSesion(usuario, password);
    } catch (err) {
      setError(err.message);
      setEnviando(false);
      setDespertando(false);
    } finally {
      clearTimeout(aviso);
    }
  }

  return (
    <div className="login">
      <form className="tarjeta" onSubmit={enviar}>
        <h1>al Rojo Vivo!!! - Borratina</h1>
        <p className="subtitulo">Ingresá con tu cuenta de vendedor o administrador.</p>

        <MensajeError>{error}</MensajeError>

        <div className="campo">
          <label htmlFor="usuario">Usuario</label>
          <input
            id="usuario"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            autoComplete="username"
            // El backend normaliza a minúsculas igual, pero que el campo no
            // "autocorrija" evita que el teclado del teléfono ponga mayúscula
            // en la primera letra y parezca que la credencial está mal.
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            required
            autoFocus
          />
        </div>

        <div className="campo">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <button type="submit" disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>

        {/* Debajo del botón y no arriba del formulario: es sobre lo que está
            pasando recién ahora, no sobre lo que hay que completar. */}
        {despertando && (
          <div className="aviso" role="status" style={{ margin: '0.9rem 0 0' }}>
            El servidor está despertando. Puede tardar hasta un minuto: no cierres la pantalla.
          </div>
        )}
      </form>
    </div>
  );
}
