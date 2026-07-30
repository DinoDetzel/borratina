import { useEffect, useState } from 'react';

import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Cargando, Chip, MensajeError, MensajeExito, Vacio } from '../componentes/comunes.jsx';
import { fechaHora } from '../utilidades.js';

const NUEVO = { nombre: '', usuario: '', email: '', password: '', rol: 'vendedor' };

export default function AdminUsuarios() {
  const { usuario: yo } = useAuth();

  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const [nuevo, setNuevo] = useState(NUEVO);
  const [creando, setCreando] = useState(false);

  async function traer() {
    setCargando(true);
    try {
      const { usuarios } = await api.usuarios.listar();
      setUsuarios(usuarios);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    traer();
  }, []);

  async function crear(evento) {
    evento.preventDefault();
    setError('');
    setExito('');
    setCreando(true);

    try {
      await api.usuarios.crear(nuevo);
      setExito(`Cuenta de ${nuevo.nombre} creada.`);
      setNuevo(NUEVO);
      await traer();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreando(false);
    }
  }

  async function cambiarActivo(u) {
    setError('');
    setExito('');
    try {
      await api.usuarios.cambiarActivo(u.id, !u.activo);
      setExito(`${u.nombre} quedó ${u.activo ? 'desactivado' : 'activo'}.`);
      await traer();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <div className="encabezado-seccion">
        <h1>Usuarios</h1>
      </div>

      <MensajeError>{error}</MensajeError>
      <MensajeExito>{exito}</MensajeExito>

      <div className="tarjeta" style={{ marginBottom: '1rem' }}>
        <h2 style={{ marginBottom: '0.4rem' }}>Nueva cuenta</h2>
        <p style={{ color: 'var(--tinta-2)', fontSize: '0.85rem', marginTop: 0 }}>
          No hay registro público: las cuentas las creás vos.
        </p>

        <form onSubmit={crear}>
          <div className="fila">
            <div>
              <label htmlFor="u-nombre">Nombre</label>
              <input
                id="u-nombre"
                value={nuevo.nombre}
                onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
                required
              />
            </div>
            <div>
              <label htmlFor="u-usuario">Usuario</label>
              <input
                id="u-usuario"
                value={nuevo.usuario}
                onChange={(e) => setNuevo({ ...nuevo, usuario: e.target.value })}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                placeholder="juanp"
                required
              />
            </div>
            <div>
              <label htmlFor="u-email">Email (opcional)</label>
              <input
                id="u-email"
                type="email"
                value={nuevo.email}
                onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="u-password">Contraseña</label>
              <input
                id="u-password"
                type="password"
                minLength={8}
                value={nuevo.password}
                onChange={(e) => setNuevo({ ...nuevo, password: e.target.value })}
                required
              />
            </div>
            <div>
              <label htmlFor="u-rol">Rol</label>
              <select
                id="u-rol"
                value={nuevo.rol}
                onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value })}
              >
                <option value="vendedor">Vendedor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div style={{ flex: '0 0 auto' }}>
              <button type="submit" disabled={creando}>
                {creando ? 'Creando…' : 'Crear'}
              </button>
            </div>
          </div>
          <p style={{ color: 'var(--tinta-apagada)', fontSize: '0.8rem', marginBottom: 0 }}>
            El usuario es con el que entra a la app: entre 3 y 30 caracteres, sin espacios ni
            acentos. La contraseña, mínimo 8 caracteres.
          </p>
        </form>
      </div>

      <div className="tarjeta">
        {cargando ? (
          <Cargando />
        ) : usuarios.length === 0 ? (
          <Vacio>No hay usuarios.</Vacio>
        ) : (
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Usuario</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Alta</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} style={{ opacity: u.activo ? 1 : 0.55 }}>
                    <td>
                      {u.nombre}
                      {u.id === yo.id && (
                        <span style={{ color: 'var(--tinta-apagada)' }}> (vos)</span>
                      )}
                    </td>
                    <td className="codigo">{u.usuario}</td>
                    <td>{u.email ?? <span style={{ color: 'var(--tinta-apagada)' }}>—</span>}</td>
                    <td>{u.rol}</td>
                    <td>
                      <Chip estado={u.activo ? 'abierto' : 'anulada'}>
                        {u.activo ? 'Activo' : 'Desactivado'}
                      </Chip>
                    </td>
                    <td style={{ color: 'var(--tinta-2)', fontSize: '0.85rem' }}>
                      {fechaHora(u.created_at)}
                    </td>
                    <td>
                      {/* El backend rechaza desactivarse a uno mismo; acá ni lo ofrecemos. */}
                      {u.id !== yo.id && (
                        <button
                          className={u.activo ? 'peligro chico' : 'secundario chico'}
                          onClick={() => cambiarActivo(u)}
                        >
                          {u.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      )}
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
