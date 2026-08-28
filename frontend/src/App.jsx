import { Navigate, NavLink, Route, Routes } from 'react-router-dom';

import { useAuth } from './auth.jsx';
import { Cargando } from './componentes/comunes.jsx';
import Login from './paginas/Login.jsx';
import Vendedor from './paginas/Vendedor.jsx';
import ConsultarComprobante from './paginas/ConsultarComprobante.jsx';
import AdminDashboard from './paginas/AdminDashboard.jsx';
import AdminSorteos from './paginas/AdminSorteos.jsx';
import AdminSorteoDetalle from './paginas/AdminSorteoDetalle.jsx';
import AdminVendedores from './paginas/AdminVendedores.jsx';
import AdminUsuarios from './paginas/AdminUsuarios.jsx';

/**
 * Envuelve las rutas que exigen sesión. `soloAdmin` además exige el rol.
 * Es comodidad de navegación, no seguridad: quien manda es el backend, que
 * valida rol en cada endpoint.
 */
function Protegida({ soloAdmin = false, children }) {
  const { usuario, cargando, esAdmin } = useAuth();

  if (cargando) return <Cargando />;
  if (!usuario) return <Navigate to="/login" replace />;
  if (soloAdmin && !esAdmin) return <Navigate to="/cargar" replace />;

  return children;
}

function Navegacion() {
  const { esAdmin } = useAuth();

  // Consultar es de los dos roles: el que atiende al comprador que viene a
  // reclamar es el vendedor, no el admin.
  const enlaces = esAdmin
    ? [
        ['/admin', 'Panel'],
        ['/admin/sorteos', 'Sorteos'],
        ['/admin/usuarios', 'Usuarios'],
        ['/cargar', 'Cargar jugada'],
        ['/comprobante', 'Consultar'],
      ]
    : [
        ['/cargar', 'Cargar jugada'],
        ['/comprobante', 'Consultar'],
      ];

  // Con un solo destino la barra de navegación no aporta nada.
  if (enlaces.length === 1) return null;

  return (
    <nav className="nav">
      {enlaces.map(([a, texto]) => (
        <NavLink
          key={a}
          to={a}
          // Solo /admin necesita coincidencia exacta: si no, quedaría marcado
          // en todas las pantallas del panel. Las demás sí tienen que seguir
          // marcadas en sus subpáginas, como el detalle de un sorteo.
          end={a === '/admin'}
          className={({ isActive }) => (isActive ? 'activo' : '')}
        >
          {texto}
        </NavLink>
      ))}
    </nav>
  );
}

function Cabecera() {
  const { usuario, cerrarSesion } = useAuth();

  return (
    <header className="cabecera">
      <span className="marca">al Rojo Vivo!!! - Borratina</span>
      <span className="quien">
        {usuario.nombre}
        {/* El rol se cae en el teléfono: uno sabe con qué cuenta entró, y con
            el nombre largo arriba la cabecera se partía en dos renglones. */}
        <span className="rol"> · {usuario.rol}</span>
      </span>
      <button className="secundario chico" onClick={cerrarSesion}>
        Salir
      </button>
    </header>
  );
}

function Estructura({ children }) {
  return (
    <div className="app">
      <Cabecera />
      <Navegacion />
      <main className="contenido">{children}</main>
    </div>
  );
}

export default function App() {
  const { usuario, cargando, esAdmin } = useAuth();

  if (cargando) return <Cargando />;

  return (
    <Routes>
      <Route
        path="/login"
        element={usuario ? <Navigate to={esAdmin ? '/admin' : '/cargar'} replace /> : <Login />}
      />

      <Route
        path="/cargar"
        element={
          <Protegida>
            <Estructura>
              <Vendedor />
            </Estructura>
          </Protegida>
        }
      />

      {/* De los dos roles: el vendedor es el que atiende al comprador que se
          presenta con el papel. El backend le muestra solo las suyas. */}
      <Route
        path="/comprobante"
        element={
          <Protegida>
            <Estructura>
              <ConsultarComprobante />
            </Estructura>
          </Protegida>
        }
      />

      <Route
        path="/admin"
        element={
          <Protegida soloAdmin>
            <Estructura>
              <AdminDashboard />
            </Estructura>
          </Protegida>
        }
      />
      <Route
        path="/admin/sorteos"
        element={
          <Protegida soloAdmin>
            <Estructura>
              <AdminSorteos />
            </Estructura>
          </Protegida>
        }
      />
      <Route
        path="/admin/sorteos/:id"
        element={
          <Protegida soloAdmin>
            <Estructura>
              <AdminSorteoDetalle />
            </Estructura>
          </Protegida>
        }
      />
      {/* Se llega desde el panel, igual que al detalle de un sorteo: es el
          desarrollo de una tarjeta, no una sección aparte. */}
      <Route
        path="/admin/vendedores"
        element={
          <Protegida soloAdmin>
            <Estructura>
              <AdminVendedores />
            </Estructura>
          </Protegida>
        }
      />
      <Route
        path="/admin/usuarios"
        element={
          <Protegida soloAdmin>
            <Estructura>
              <AdminUsuarios />
            </Estructura>
          </Protegida>
        }
      />

      <Route path="*" element={<Navigate to={usuario ? (esAdmin ? '/admin' : '/cargar') : '/login'} replace />} />
    </Routes>
  );
}
