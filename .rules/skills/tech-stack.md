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
| Cargar el extracto del sorteo (20 números) | ❌ | ✅ |

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
- **El login se frena a 10 fallos por cuenta, 15 minutos** (`utils/intentos-de-login.js`),
  en memoria y sin dependencias nuevas. Se cuenta **por usuario y no por IP**: los
  vendedores comparten la red del club, así que por IP un solo atacante los deja a
  todos afuera en horario de venta, y detrás del proxy de Render `req.ip` es el del
  proxy salvo que se configure `trust proxy`. Frenar por IP queda para si alguna vez
  hace falta cubrir el rociado sobre muchas cuentas, y exige `trust proxy` antes.

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
    │   ├── comprobante.js       # normalizar el código + armar el comprobante
    │   └── intentos-de-login.js # freno de fuerza bruta, por cuenta
    └── routes/
        ├── auth.routes.js
        ├── sorteos.routes.js
        ├── jugadas.routes.js
        └── dashboard.routes.js

test/                            # node:test — ver "Tests", más abajo
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
- **La zona horaria del club es del sistema, no del servidor ni del teléfono.**
  `config.zonaHoraria` (`TZ_CLUB`, por defecto `America/Argentina/Buenos_Aires`)
  rige en los tres lugares donde se decide "qué día es":
  - el **pool** (`db.js`), así las conexiones leen los `timestamptz` en hora del
    club aunque el Postgres corra en UTC;
  - los **mensajes con fecha** del backend (`jugadas.routes.js`) y el período que
    calcula el seed;
  - el **frontend**, que la recibe con el usuario en `/auth/login` y `/auth/me` y
    formatea todo ahí (`fijarZonaClub` en `utilidades.js`). Se manda y no se
    duplica del lado del cliente para que siga habiendo una sola fuente de verdad.

  Sin esto, una jugada de las 21:30 cae en el día siguiente, y un vendedor con el
  teléfono en otra zona ve un día distinto del que lleva impreso el comprobante.
  No cambia lo que se guarda, solo cómo se lee.

  La excepción es la fecha del **código de comprobante**, que va escrita dentro de
  `generar_codigo_jugada()` (migración 012) y no sigue a `TZ_CLUB`: sale impresa
  en un papel y no puede depender de una variable de entorno. Si el club alguna
  vez se mudara de zona, eso pide su propia migración.

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
    └── paginas/             # Login, Vendedor, ConsultarComprobante, Admin*
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
agregadas: un corredor externo habría sido la primera.

- **Backend** (`npm test` en `backend/`): la regla de ganadores, la normalización
  de números, el código de comprobante y el freno de intentos de login. Lo que
  justifica la suite es el bloque de **paridad**, que corre `condicionGanadora()`
  (SQL, contra un Postgres real) y `esGanadora()` (JS) sobre los mismos casos y
  compara. Sin `DATABASE_URL` esos se saltean en vez de fallar.
- **Rutas** (`test/rutas.test.js`): los permisos y los candados de estado, contra
  la API levantada de verdad. Quién ve qué, qué no se toca después del sorteo, un
  solo sorteo abierto a la vez. **Piden `TEST_DATABASE_URL`**, con una base
  descartable: escriben, y reusar `DATABASE_URL` sería un tiro al pie el día que
  alguien la tenga apuntando a Supabase. Sin esa variable —o si no responde— se
  saltean.
- **Frontend** (`npm test` en `frontend/`): sincronía entre las dos versiones del
  comprobante (compara los **fuentes** de `comprobanteImagen.js` y
  `Comprobante.jsx`) y el formato de fechas, que fija la zona a mano porque en
  UTC el error no se ve. No hace falta DOM ni navegador.

El patrón de los dos primeros es el mismo: **lo que se testea es lo que está
escrito dos veces**, porque es lo que se desincroniza sin que nada avise. Los de
rutas van por otro motivo: son reglas que viven en un `WHERE` y en un `if`, donde
ningún `CHECK` de la base las respalda.

### En CI se corren todos, sin excepción

`.github/workflows/ci.yml` levanta un Postgres de servicio y le pasa las dos
variables, así que en GitHub la suite corre entera.

Y **cuando la variable `CI` está puesta, los tests que dependen de la base dejan
de saltearse y fallan**. Es la parte que importa: un `describe` salteado registra
*cero* tests, no tests salteados, así que la suite adelgaza sin que ningún
contador se entere y el build queda verde con sesenta y pico de asserts mudos.
Local siguen salteándose, que es lo correcto — nadie quiere levantar un Postgres
para tocar un `.css`.

El workflow además exige `# skipped 0` y un piso de tests corridos, como respaldo
por si algo se escapa por una vía que no previmos.

### La documentación también se verifica

`.github/scripts/consistencia-rules.sh` ata lo que de `.rules/` es comprobable
por máquina: que ningún enlace entre corchetes apunte a un archivo inexistente,
que cada migración del disco tenga su fila en [[esquema-base-datos]], que ningún
`.md` afirme un número de migraciones que no sea el real, y que las rutas de
código citadas existan.

El criterio no se puede chequear con `grep`, pero las afirmaciones sobre el repo
sí, y son las que se cuelan justamente por aburridas: el índice llegó a contar
doce migraciones cuando había trece. Corre solo, sin base ni dependencias.

Sin cubrir: cómo se **ve** el comprobante, que está anotado como pendiente aparte.

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
