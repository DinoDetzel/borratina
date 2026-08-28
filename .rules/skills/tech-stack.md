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
│   ├── seed.js                  # admin + vendedores de prueba
│   └── migrations/              # 001 … 013, ver memories/esquema-base-datos.md
└── src/
    ├── server.js                # arranque HTTP
    ├── app.js                   # Express + montaje de rutas
    ├── config.js                # env vars validadas + zona horaria del club
    ├── db.js                    # pool de pg + helpers query/tx
    ├── middleware/
    │   ├── auth.js              # requireAuth / requireAdmin
    │   └── errors.js            # AppError + handler central
    ├── utils/
    │   ├── numeros.js           # normalizar / validar los 4 números
    │   ├── ganadores.js         # la regla "4 dentro de 20", en SQL y en JS
    │   └── comprobante.js       # normalizar el código + armar el comprobante
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
- **Toda operación que cambie `jugadas.anulada` escribe su evento** en
  `jugadas_eventos`, y **en la misma transacción** que el `UPDATE` (migración
  013). `anulada_por` es el estado de hoy —el `CHECK` obliga a limpiarla al
  restaurar—, así que el historial vive en la tabla aparte. Un historial al que a
  veces le falta una entrada no sirve como historial.
- **La zona horaria del club es del sistema, no del servidor.** `config.zonaHoraria`
  (`TZ_CLUB`, por defecto `America/Argentina/Buenos_Aires`) se le pasa al pool en
  `db.js`, así que las conexiones leen los `timestamptz` en hora argentina aunque
  el Postgres corra en UTC. Sin eso, todo lo que sea "qué día es" —la fecha del
  código de comprobante, el agrupado diario del gráfico— se corre tres horas y una
  jugada de las 21:30 cae en el día siguiente. No cambia lo que se guarda, solo
  cómo se lee.

## Estructura del frontend

```
frontend/
├── vite.config.js           # proxy de /api al backend + https opcional en dev
└── src/
    ├── main.jsx             # router + contexto de auth
    ├── App.jsx              # rutas y layout
    ├── api.js               # cliente HTTP, token, manejo de 401
    ├── auth.jsx             # contexto de sesión
    ├── utilidades.js        # formato de números, pesos, fechas, períodos
    ├── comprobanteImagen.js # dibuja el comprobante en un canvas (para compartir)
    ├── whatsapp.js          # arma el enlace wa.me y dispara la Web Share API
    ├── estilos.css          # tokens de color y estilos
    ├── fuentes.css          # @font-face de las tipografías locales
    ├── fuentes/             # woff2 propios: Inter, Oswald, Barlow, Yellowtail
    ├── componentes/         # comunes, Comprobante, GraficoVentas,
    │                        # BotonCompartir, CampoFechaHora, CamposExtracto
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
- **El gráfico se carga con `React.lazy` y es el único import diferido.** Recharts
  es casi todo el peso y solo lo usa `GraficoVentas`, en el panel del admin: sin
  el corte, el vendedor se bajaba la librería entera para cargar una jugada. Son
  302 kB / 91 kB gzip de carga inicial contra 355 kB / 103 kB del gráfico aparte.
  No conviene multiplicar los `lazy` a ciegas — este vale porque el corte cae
  justo entre las dos pantallas.

## Tests

Con `node:test`, el runner que viene con Node 20. Sin dependencias de desarrollo
agregadas: un corredor externo habría sido la primera, para correr unos setenta
asserts.

- **Backend** (`npm test` en `backend/`): la regla de ganadores, la normalización
  de números y el código de comprobante. Lo que justifica la suite es el bloque
  de **paridad**, que corre `condicionGanadora()` (SQL, contra un Postgres real)
  y `esGanadora()` (JS) sobre los mismos casos y compara. Sin `DATABASE_URL` esos
  se saltean en vez de fallar.
- **Frontend** (`npm test` en `frontend/`): sincronía entre las dos versiones del
  comprobante. Compara los **fuentes** de `comprobanteImagen.js` y
  `Comprobante.jsx` para que consuman los mismos datos y digan los mismos textos.
  No hace falta DOM ni navegador.

El patrón en los dos casos es el mismo: **lo que se testea es lo que está escrito
dos veces**, porque es lo que se desincroniza sin que nada avise.

Sin cubrir: las rutas del backend, que se verifican a mano, y cómo se **ve** el
comprobante, que está anotado como pendiente aparte.

## Pendiente de definir

> Acá está el planteo de los pendientes **técnicos**. La lista completa —con los
> de producto, la urgencia y el orden— está en `memories/pendientes.md`, que es el
> único índice.

- **Variables de entorno y secretos entre Vercel, Render y Supabase.** Estaba
  anotado en una línea desde el principio; el inventario se hizo el 2026-08-27 y
  quedó más chico de lo que parecía.

  | Variable | Dónde vive | ¿Secreta? |
  |---|---|---|
  | `DATABASE_URL` | Render + `.env` local | **sí**, lleva la contraseña de Supabase |
  | `JWT_SECRET` | Render + `.env` local | **sí** |
  | `CORS_ORIGIN` | Render | no, pero si está mal el front queda mudo |
  | `DATABASE_SSL`, `JWT_EXPIRES_IN`, `PORT`, `TZ_CLUB` | Render | no |
  | `VITE_API_URL` | Vercel | no |
  | `BACKEND_URL` | solo en desarrollo | no |

  **Son dos secretos, no una constelación.** El `.env` está ignorado por git y el
  local apunta a un Postgres de desarrollo, no a Supabase. Lo que falta no es un
  gestor de secretos —para dos valores y un solo desarrollador, eso agrega una
  dependencia externa y un punto de falla para resolver un problema que no
  existe— sino documentación operativa. Tres huecos concretos:

  1. **No hay un solo lugar que diga qué va dónde.** Hoy se deduce cruzando el
     `.env.example` con la sección de deploy de cada README. Si cambia el dominio
     de Vercel, hay que acordarse de que `CORS_ORIGIN` vive en Render.
  2. **El frontend no tiene `.env.example`.** `VITE_API_URL` es obligatoria en
     Vercel —sin ella el front pega a `/api` del mismo dominio, que ahí no
     existe— y solo está mencionada en prosa.
  3. **No está escrito cómo rotar el `JWT_SECRET`.** El mecanismo sí; la
     consecuencia operativa no: cambiarlo **cierra todas las sesiones abiertas de
     golpe**. Hacerlo un martes a las 21 deja a los vendedores afuera en pleno
     horario de venta.

  Se vuelve urgente si entra alguien más al proyecto o si hay que rotar el
  secreto de verdad. Consultado el 2026-08-27: se deja para después.
