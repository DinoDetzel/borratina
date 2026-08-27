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
│   └── migrations/              # 001 … 012, ver memories/esquema-base-datos.md
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

## Pendiente de definir

> Acá está el planteo de los pendientes **técnicos**. La lista completa —con los
> de producto, la urgencia y el orden— está en `memories/pendientes.md`, que es el
> único índice.

- Testing: **el backend tiene tests desde el 2026-08-26**, con `node:test` (viene
  con Node 20, no agrega dependencias). Cubren `utils/`: la regla de ganadores
  —incluida la paridad entre la versión SQL y la JS, contra un Postgres real—,
  la normalización de números y el código de comprobante. `npm test` en
  `backend/`, detalle en su README.

  Lo que **no** está cubierto: las rutas, que se siguen verificando a mano, y la
  otra regla duplicada —el comprobante maquetado en canvas y en JSX
  (`comprobanteImagen.js` vs `Comprobante.jsx`)—, que necesitaría render y
  comparación visual. El frontend no tiene runner configurado.
- Manejo de variables de entorno / secretos entre Vercel, Render y Supabase.
- El bundle del frontend pesa ~654 kB sin comprimir (194 kB gzip), casi todo
  Recharts, y el build avisa que pasa los 500 kB. Si molesta, se parte con
  `import()` dinámico del gráfico. Las tipografías (~228 kB en nueve `.woff2`)
  van aparte y se piden solo cuando hacen falta. Medido el 2026-08-26.
- El rastro de las anulaciones **ya está** (migración 013, 2026-08-27): el
  historial vive en `jugadas_eventos` y no en `jugadas`, porque el
  `CHECK chk_jugadas_anulacion` obliga a limpiar `anulada_por` al restaurar y esa
  columna es el estado de hoy, no el pasado. Quien agregue una operación que
  cambie `anulada` tiene que escribir su evento en la misma transacción.