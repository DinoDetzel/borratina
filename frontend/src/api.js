/**
 * Cliente HTTP de la API.
 *
 * En desarrollo se deja vacío y el proxy de Vite manda /api al backend local.
 * En producción se define VITE_API_URL con la URL de Render.
 */
const BASE = import.meta.env.VITE_API_URL ?? '';

const CLAVE_TOKEN = 'borratina_token';

export const leerToken = () => localStorage.getItem(CLAVE_TOKEN);
export const guardarToken = (token) => localStorage.setItem(CLAVE_TOKEN, token);
export const borrarToken = () => localStorage.removeItem(CLAVE_TOKEN);

/** Error de la API con su status, para poder distinguir un 401 de un 409. */
export class ErrorApi extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
    this.name = 'ErrorApi';
  }
}

/** Se dispara ante un 401 para que el contexto de auth cierre la sesión. */
const AL_EXPIRAR = 'borratina:sesion-expirada';
export const alExpirarSesion = (cb) => {
  window.addEventListener(AL_EXPIRAR, cb);
  return () => window.removeEventListener(AL_EXPIRAR, cb);
};

async function pedir(ruta, opciones = {}) {
  const token = leerToken();

  const respuesta = await fetch(`${BASE}/api${ruta}`, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opciones.headers,
    },
  });

  // 204 y similares no traen cuerpo.
  const cuerpo = respuesta.status === 204 ? null : await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    if (respuesta.status === 401 && token) {
      // El token venció o la cuenta se desactivó: que la app vuelva al login.
      borrarToken();
      window.dispatchEvent(new Event(AL_EXPIRAR));
    }
    throw new ErrorApi(respuesta.status, cuerpo?.error ?? 'No se pudo conectar con el servidor.');
  }

  return cuerpo;
}

/** Arma un query string salteando los filtros vacíos. */
const qs = (params = {}) => {
  const limpio = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return limpio.length ? `?${new URLSearchParams(limpio)}` : '';
};

export const api = {
  login: (usuario, password) =>
    pedir('/auth/login', { method: 'POST', body: JSON.stringify({ usuario, password }) }),
  yo: () => pedir('/auth/me'),

  usuarios: {
    listar: () => pedir('/auth/usuarios'),
    crear: (datos) => pedir('/auth/usuarios', { method: 'POST', body: JSON.stringify(datos) }),
    cambiarActivo: (id, activo) =>
      pedir(`/auth/usuarios/${id}/activo`, { method: 'PATCH', body: JSON.stringify({ activo }) }),
  },

  sorteos: {
    listar: () => pedir('/sorteos'),
    actual: () => pedir('/sorteos/actual'),
    abrir: (datos) => pedir('/sorteos', { method: 'POST', body: JSON.stringify(datos) }),
    cambiarPozo: (id, pozo) =>
      pedir(`/sorteos/${id}/pozo`, { method: 'PATCH', body: JSON.stringify({ pozo }) }),
    cambiarVentana: (id, iniciaAt, finalizaAt) =>
      pedir(`/sorteos/${id}/ventana`, {
        method: 'PATCH',
        body: JSON.stringify({ inicia_at: iniciaAt, finaliza_at: finalizaAt }),
      }),
    cerrar: (id) => pedir(`/sorteos/${id}/cerrar`, { method: 'PATCH' }),
    cargarResultado: (id, numeros) =>
      pedir(`/sorteos/${id}/resultado`, { method: 'POST', body: JSON.stringify({ numeros }) }),
    ganadores: (id) => pedir(`/sorteos/${id}/ganadores`),
  },

  jugadas: {
    cargar: (datos) => pedir('/jugadas', { method: 'POST', body: JSON.stringify(datos) }),
    listar: (filtros) => pedir(`/jugadas${qs(filtros)}`),
    porComprobante: (codigo) => pedir(`/jugadas/comprobante/${encodeURIComponent(codigo)}`),
    editar: (id, datos) => pedir(`/jugadas/${id}`, { method: 'PATCH', body: JSON.stringify(datos) }),
    anular: (id) => pedir(`/jugadas/${id}/anular`, { method: 'POST' }),
    restaurar: (id) => pedir(`/jugadas/${id}/restaurar`, { method: 'POST' }),
  },

  dashboard: {
    resumen: (sorteoId) => pedir(`/dashboard/resumen${qs({ sorteo_id: sorteoId })}`),
    porVendedor: (sorteoId) => pedir(`/dashboard/por-vendedor${qs({ sorteo_id: sorteoId })}`),
    ventas: (sorteoId) => pedir(`/dashboard/ventas${qs({ sorteo_id: sorteoId })}`),
    historial: () => pedir('/dashboard/historial'),
    numerosMasJugados: (sorteoId) =>
      pedir(`/dashboard/numeros-mas-jugados${qs({ sorteo_id: sorteoId })}`),
  },
};
