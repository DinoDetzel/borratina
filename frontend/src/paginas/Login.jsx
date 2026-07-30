import { useState } from 'react';

import { useAuth } from '../auth.jsx';
import { MensajeError } from '../componentes/comunes.jsx';

export default function Login() {
  const { iniciarSesion } = useAuth();

  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento) {
    evento.preventDefault();
    setError('');
    setEnviando(true);

    try {
      // El redirect lo resuelve App al cambiar el usuario del contexto.
      await iniciarSesion(usuario, password);
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  }

  return (
    <div className="login">
      <form className="tarjeta" onSubmit={enviar}>
        <h1>Borratina</h1>
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
      </form>
    </div>
  );
}
