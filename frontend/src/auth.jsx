import { createContext, useContext, useEffect, useState } from 'react';

import { api, alExpirarSesion, borrarToken, guardarToken, leerToken } from './api.js';
import { fijarZonaClub } from './utilidades.js';

const ContextoAuth = createContext(null);

export function ProveedorAuth({ children }) {
  const [usuario, setUsuario] = useState(null);
  // Arranca cargando solo si hay un token guardado que haya que revalidar.
  const [cargando, setCargando] = useState(Boolean(leerToken()));

  // Al abrir la app con un token en localStorage, lo revalidamos contra el
  // backend: pudo haber vencido o le pudieron haber dado de baja la cuenta.
  useEffect(() => {
    if (!leerToken()) return;

    api
      .yo()
      // La zona del club viene con el usuario: todo lo que se muestre se
      // formatea ahí y no en la del dispositivo. Ver `fijarZonaClub`.
      .then(({ usuario, zona_horaria }) => {
        fijarZonaClub(zona_horaria);
        setUsuario(usuario);
      })
      .catch(() => borrarToken())
      .finally(() => setCargando(false));
  }, []);

  // Si cualquier request devuelve 401, cerramos sesión en toda la app.
  useEffect(() => alExpirarSesion(() => setUsuario(null)), []);

  const iniciarSesion = async (nombreUsuario, password) => {
    const { token, usuario, zona_horaria } = await api.login(nombreUsuario, password);
    guardarToken(token);
    // Se fija ya en el login y no recién en el `/auth/me` del próximo arranque:
    // la primera pantalla después de entrar ya muestra fechas.
    fijarZonaClub(zona_horaria);
    setUsuario(usuario);
    return usuario;
  };

  const cerrarSesion = () => {
    borrarToken();
    setUsuario(null);
  };

  const valor = {
    usuario,
    cargando,
    iniciarSesion,
    cerrarSesion,
    esAdmin: usuario?.rol === 'admin',
  };

  return <ContextoAuth.Provider value={valor}>{children}</ContextoAuth.Provider>;
}

export function useAuth() {
  const contexto = useContext(ContextoAuth);
  if (!contexto) throw new Error('useAuth tiene que usarse dentro de <ProveedorAuth>.');
  return contexto;
}
