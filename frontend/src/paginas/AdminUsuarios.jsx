import { useEffect, useState } from 'react';

import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import {
  Cargando,
  Chip,
  Dialogo,
  MensajeError,
  MensajeExito,
  Vacio,
} from '../componentes/comunes.jsx';
import { fechaDia } from '../utilidades.js';

const NUEVO = { nombre: '', usuario: '', password: '', rol: 'vendedor' };

export default function AdminUsuarios() {
  const { usuario: yo } = useAuth();

  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const [nuevo, setNuevo] = useState(NUEVO);
  const [creando, setCreando] = useState(false);

  // Cartel abierto: { tipo: 'editar' | 'password' | 'borrar', usuario, ... }.
  // Uno solo a la vez, así que alcanza con un estado.
  const [cartel, setCartel] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const cerrarCartel = () => setCartel(null);

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

  /**
   * Ejecuta lo que confirma el cartel. Si sale bien lo cierra y refresca; si
   * falla lo deja abierto con el error adentro, para no perder lo tipeado.
   */
  async function confirmarCartel(fn, mensaje) {
    setError('');
    setExito('');
    setGuardando(true);
    try {
      await fn();
      setExito(mensaje);
      cerrarCartel();
      await traer();
    } catch (err) {
      setCartel((c) => ({ ...c, error: err.message }));
    } finally {
      setGuardando(false);
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
                required
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
          </div>

          {/* El formato a la izquierda y el botón contra el borde derecho: lo
              que hay que saber antes de crear, separado de crearla. */}
          <div className="barra-filtros">
            <p style={{ color: 'var(--tinta-apagada)', fontSize: '0.8rem', margin: 0, flex: 1 }}>
              El usuario es con el que entra a la app: entre 3 y 30 caracteres, sin espacios ni
              acentos. La contraseña, mínimo 8 caracteres.
            </p>
            <button type="submit" disabled={creando}>
              {creando ? 'Creando…' : 'Crear'}
            </button>
          </div>
        </form>
      </div>

      <div className="tarjeta">
        {cargando ? (
          <Cargando />
        ) : usuarios.length === 0 ? (
          <Vacio>No hay usuarios.</Vacio>
        ) : (
          <div className="tabla-scroll">
            <table className="tabla-a-lista">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Alta</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} className={u.activo ? '' : 'apagada'}>
                    <td>
                      {u.nombre}
                      {u.id === yo.id && (
                        <span style={{ color: 'var(--tinta-apagada)' }}> (vos)</span>
                      )}
                      {/* Estar activo es lo normal: un chip en cada fila sería
                          ruido. Se marca solo la excepción. */}
                      {!u.activo && (
                        <div style={{ marginTop: '0.2rem' }}>
                          <Chip estado="anulada">Desactivado</Chip>
                        </div>
                      )}
                    </td>
                    <td className="codigo">{u.usuario}</td>
                    <td data-movil="Rol">{u.rol}</td>
                    <td
                      data-movil="Alta"
                      style={{
                        color: 'var(--tinta-2)',
                        fontSize: '0.85rem',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {fechaDia(u.created_at)}
                    </td>
                    {/* Cuatro botones con borde por fila eran una pared de
                        cajitas repetida cinco veces. Como acciones de texto se
                        leen igual y la tabla deja de gritar. */}
                    <td>
                      <div className="acciones-fila">
                        <button
                          className="enlace"
                          onClick={() =>
                            setCartel({
                              tipo: 'editar',
                              usuario: u,
                              nombre: u.nombre,
                              login: u.usuario,
                              rol: u.rol,
                            })
                          }
                        >
                          Editar
                        </button>

                        <button
                          className="enlace"
                          onClick={() =>
                            setCartel({ tipo: 'password', usuario: u, password: '', repetida: '' })
                          }
                        >
                          Contraseña
                        </button>

                        {/* El backend rechaza desactivarse y borrarse a uno
                            mismo; acá ni lo ofrecemos. */}
                        {u.id !== yo.id && (
                          <>
                            {/* Desactivar no es destructivo: se revierte con la
                                misma acción. El rojo queda para Eliminar, que es
                                el único que no se puede deshacer. */}
                            <button className="enlace" onClick={() => cambiarActivo(u)}>
                              {u.activo ? 'Desactivar' : 'Activar'}
                            </button>
                            <button
                              className="enlace peligro"
                              onClick={() => setCartel({ tipo: 'borrar', usuario: u })}
                            >
                              Eliminar
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {cartel?.tipo === 'editar' && (
        <Dialogo
          titulo={`Editar a ${cartel.usuario.nombre}`}
          confirmar="Guardar"
          ocupado={guardando}
          onCerrar={cerrarCartel}
          onConfirmar={() =>
            confirmarCartel(
              () =>
                api.usuarios.editar(cartel.usuario.id, {
                  nombre: cartel.nombre,
                  usuario: cartel.login,
                  rol: cartel.rol,
                }),
              'Cuenta actualizada.',
            )
          }
        >
          <MensajeError>{cartel.error}</MensajeError>

          <div className="campo">
            <label htmlFor="ed-nombre">Nombre</label>
            <input
              id="ed-nombre"
              value={cartel.nombre}
              onChange={(e) => setCartel({ ...cartel, nombre: e.target.value })}
              required
            />
          </div>

          <div className="campo">
            <label htmlFor="ed-usuario">Usuario</label>
            <input
              id="ed-usuario"
              value={cartel.login}
              onChange={(e) => setCartel({ ...cartel, login: e.target.value })}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              required
            />
            <p style={{ color: 'var(--tinta-apagada)', fontSize: '0.8rem', margin: '0.3rem 0 0' }}>
              Si lo cambiás, tiene que entrar con el nuevo.
            </p>
          </div>

          <div className="campo">
            <label htmlFor="ed-rol">Rol</label>
            <select
              id="ed-rol"
              value={cartel.rol}
              onChange={(e) => setCartel({ ...cartel, rol: e.target.value })}
              // Sacarte a vos mismo el rol de admin te deja afuera del panel.
              disabled={cartel.usuario.id === yo.id}
            >
              <option value="vendedor">Vendedor</option>
              <option value="admin">Administrador</option>
            </select>
            {cartel.usuario.id === yo.id && (
              <p style={{ color: 'var(--tinta-apagada)', fontSize: '0.8rem', margin: '0.3rem 0 0' }}>
                No podés cambiarte el rol a vos mismo.
              </p>
            )}
          </div>
        </Dialogo>
      )}

      {cartel?.tipo === 'password' && (
        <Dialogo
          titulo={`Contraseña de ${cartel.usuario.nombre}`}
          confirmar="Cambiar"
          ocupado={guardando}
          onCerrar={cerrarCartel}
          onConfirmar={() => {
            if (cartel.password !== cartel.repetida) {
              return setCartel({ ...cartel, error: 'Las dos contraseñas no coinciden.' });
            }
            return confirmarCartel(
              () => api.usuarios.cambiarPassword(cartel.usuario.id, cartel.password),
              `Contraseña de ${cartel.usuario.nombre} cambiada. Pasásela para que entre.`,
            );
          }}
        >
          <MensajeError>{cartel.error}</MensajeError>

          <p>
            La anterior no hace falta: nadie la puede leer, ni vos. Anotá la nueva antes de
            confirmar, porque después tampoco se va a poder ver.
          </p>

          <div className="campo">
            <label htmlFor="pw-nueva">Contraseña nueva</label>
            <input
              id="pw-nueva"
              type="password"
              minLength={8}
              autoComplete="new-password"
              value={cartel.password}
              onChange={(e) => setCartel({ ...cartel, password: e.target.value, error: '' })}
              required
            />
          </div>

          <div className="campo">
            <label htmlFor="pw-repetida">Repetila</label>
            <input
              id="pw-repetida"
              type="password"
              autoComplete="new-password"
              value={cartel.repetida}
              onChange={(e) => setCartel({ ...cartel, repetida: e.target.value, error: '' })}
              required
            />
          </div>

          <p style={{ fontSize: '0.82rem' }}>
            Si tenía la sesión abierta en el celular, se le va a cerrar.
          </p>
        </Dialogo>
      )}

      {cartel?.tipo === 'borrar' && (
        <Dialogo
          titulo={`¿Eliminar a ${cartel.usuario.nombre}?`}
          confirmar="Sí, eliminar"
          peligro
          ocupado={guardando}
          onCerrar={cerrarCartel}
          onConfirmar={() =>
            confirmarCartel(
              () => api.usuarios.borrar(cartel.usuario.id),
              `La cuenta de ${cartel.usuario.nombre} se eliminó.`,
            )
          }
        >
          <MensajeError>{cartel.error}</MensajeError>

          <p>
            Se borra la cuenta <span className="codigo">{cartel.usuario.usuario}</span> y no se
            puede deshacer.
          </p>
          <p>
            Si ya cargó jugadas no se va a poder borrar, porque se perdería el historial: en ese
            caso, desactivala.
          </p>
        </Dialogo>
      )}
    </>
  );
}
