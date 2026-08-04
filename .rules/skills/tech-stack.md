# skills/tech-stack.md — Capacidades técnicas

## Stack elegido

| Capa | Tecnología |
|---|---|
| Frontend | React + Vite |
| Backend | Node.js + Express |
| Base de datos | PostgreSQL |
| Autenticación | JWT |
| Hosting frontend | Vercel |
| Hosting backend | Render |
| Hosting base de datos | Supabase (Postgres) |

Notas:
- Render (free tier) "duerme" el backend sin tráfico, primer request puede tardar.
- Supabase ya ofrece Postgres administrado; se usa JWT propio en vez de su Auth para tener control total sobre roles (vendedor/admin).

## Modelo de roles y permisos

Dos roles dentro de `usuarios`: `vendedor` y `admin`. Los compradores **no** son usuarios del sistema (no se autentican).

| Acción | Vendedor | Admin |
|---|---|---|
| Cargar jugada (números, nombre, teléfono opcional) | ✅ | ✅ |
| Ver jugadas propias | ✅ | ✅ |
| Ver jugadas de otros vendedores | ❌ | ✅ |
| Editar / anular una jugada | ❌ | ✅ |
| Crear / cerrar un sorteo | ❌ | ✅ |
| Cargar el número ganador del sorteo | ❌ | ✅ |

Reglas de implementación para la API:
- Todo endpoint de escritura sobre `jugadas` (crear) requiere JWT válido con rol `vendedor` o `admin`.
- Los listados de `jugadas` para un `vendedor` deben filtrar siempre por `WHERE vendedor_id = req.user.id`.
- Los endpoints de edición/anulación de `jugadas` y de gestión de `sorteos` deben validar rol `admin` en middleware, no solo en el frontend.

## Arquitectura general

- API REST (Express) sobre Postgres usando **`pg` con SQL plano** y queries
  parametrizadas (`$1`, `$2`, …). Sin ORM ni query builder.
- Autenticación stateless con JWT (login → token → header `Authorization: Bearer`).
- Un solo pozo/sorteo activo por mes, compartido entre todos los vendedores.
- Sin registro de pagos de premios dentro del sistema (se maneja fuera).

## Estructura del backend

```
backend/
├── package.json
├── .env.example
├── db/
│   ├── migrate.js               # runner de migraciones
│   ├── seed.js                  # admin + vendedor de prueba
│   └── migrations/
│       └── 001_init.sql
└── src/
    ├── server.js                # arranque HTTP
    ├── app.js                   # Express + montaje de rutas
    ├── config.js                # env vars validadas
    ├── db.js                    # pool de pg + helpers query/tx
    ├── middleware/
    │   ├── auth.js              # requireAuth / requireAdmin
    │   └── errors.js            # AppError + handler central
    ├── utils/
    │   └── numeros.js           # normalizar / validar los 4 números
    └── routes/
        ├── auth.routes.js
        ├── sorteos.routes.js
        ├── jugadas.routes.js
        └── dashboard.routes.js
```

Convenciones:
- Rutas montadas bajo `/api`. Nombres de recursos en plural y en español,
  consistentes con el dominio (`/api/sorteos`, `/api/jugadas`).
- Los handlers son `async` y delegan los errores al middleware central vía `next(err)`;
  los errores esperables se lanzan como `AppError(status, mensaje)`.
- Toda query va parametrizada. Nunca interpolar valores en el string SQL.
- La normalización de números vive **solo** en `utils/numeros.js`; las rutas no ordenan
  a mano.

## Estructura del frontend

```
frontend/
├── vite.config.js           # proxy de /api al backend en desarrollo
└── src/
    ├── main.jsx             # router + contexto de auth
    ├── App.jsx              # rutas y layout
    ├── api.js               # cliente HTTP, token, manejo de 401
    ├── auth.jsx             # contexto de sesión
    ├── utilidades.js        # formato de números, pesos, fechas
    ├── estilos.css          # tokens de color y estilos
    ├── componentes/         # comunes, Comprobante, GraficoVentas
    └── paginas/             # Login, Vendedor, Admin*
```

Convenciones:
- Router: `react-router-dom`. Gráficos: `recharts`. Estilos: CSS plano con
  variables, sin framework de UI.
- Las rutas por rol (`<Protegida soloAdmin>`) son comodidad de navegación, **no
  seguridad**: quien valida es el backend en cada endpoint.
- Los colores del gráfico salen de una paleta validada para daltonismo y
  contraste. Si se agregan series, revalidar antes de elegir hues a ojo.
- El estado nunca se comunica solo con color: los chips llevan la palabra al
  lado del punto, y el gráfico tiene vista de tabla equivalente.

## Pendiente de definir

- Estrategia de testing (hoy no hay tests automatizados; la verificación fue
  manual contra un Postgres real y un navegador real).
- Manejo de variables de entorno / secretos entre Vercel, Render y Supabase.
- El bundle del frontend pesa ~616 kB sin comprimir (183 kB gzip), casi todo
  Recharts. Si molesta, se parte con `import()` dinámico del gráfico.