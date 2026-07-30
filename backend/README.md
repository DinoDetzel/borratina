# Backend — Borratina Digital

API REST en Express 5 sobre PostgreSQL, con `pg` y SQL plano parametrizado.
Las reglas del juego y las decisiones de diseño están en `../.rules/`.

## Puesta en marcha

```bash
npm install
cp .env.example .env      # completar DATABASE_URL y JWT_SECRET
npm run migrate           # crea las tablas
npm run seed              # usuarios y sorteo de prueba (solo desarrollo)
npm run dev               # o npm start
```

### Postgres local con Docker

```bash
docker run -d --name borratina-pg \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=borratina \
  -p 5433:5432 postgres:16
```

Con eso, en el `.env`:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/borratina
DATABASE_SSL=false
```

Contra Supabase, `DATABASE_SSL=true`.

### Usuarios que crea el seed

| Rol | Email | Contraseña |
|---|---|---|
| admin | `admin@borratina.test` | `admin1234` |
| vendedor | `vendedor1@borratina.test` | `vende1234` |
| vendedor | `vendedor2@borratina.test` | `vende1234` |

## Endpoints

Todo cuelga de `/api`. Salvo `login` y `health`, todos piden
`Authorization: Bearer <token>`.

### Auth
| Método | Ruta | Rol | Qué hace |
|---|---|---|---|
| POST | `/auth/login` | — | Devuelve `{ token, usuario }` |
| GET | `/auth/me` | cualquiera | Datos del usuario logueado |
| GET | `/auth/usuarios` | admin | Lista usuarios |
| POST | `/auth/usuarios` | admin | Da de alta un vendedor o admin |
| PATCH | `/auth/usuarios/:id/activo` | admin | Activa o desactiva una cuenta |

### Sorteos
| Método | Ruta | Rol | Qué hace |
|---|---|---|---|
| GET | `/sorteos` | cualquiera | Todos los sorteos |
| GET | `/sorteos/actual` | cualquiera | El sorteo abierto, con pozo en vivo |
| GET | `/sorteos/:id` | cualquiera | Un sorteo |
| POST | `/sorteos` | admin | Abre el sorteo del mes |
| PATCH | `/sorteos/:id/cerrar` | admin | Corta la carga de jugadas |
| POST | `/sorteos/:id/resultado` | admin | Carga el resultado, finaliza y congela el pozo |
| GET | `/sorteos/:id/ganadores` | admin | Ganadores y reparto |

### Jugadas
| Método | Ruta | Rol | Qué hace |
|---|---|---|---|
| POST | `/jugadas` | cualquiera | Carga una jugada y emite el comprobante |
| GET | `/jugadas` | cualquiera | Listado (el vendedor solo ve las suyas) |
| GET | `/jugadas/comprobante/:codigo` | cualquiera | Recupera una jugada por su comprobante |
| GET | `/jugadas/:id` | cualquiera | Una jugada |
| PATCH | `/jugadas/:id` | admin | Corrige una jugada |
| POST | `/jugadas/:id/anular` | admin | Anula (reversible, no borra) |
| POST | `/jugadas/:id/restaurar` | admin | Revierte una anulación |

Filtros de `GET /jugadas`: `sorteo_id`, `vendedor_id` (solo admin), `comprador`,
`codigo`, `numeros` (ej: `numeros=7,23,45,88`), `incluir_anuladas`, `limit`,
`offset`.

#### Comprobante

`POST /jugadas` devuelve `{ jugada, comprobante }`. El comprobante son datos, no
HTML: el maquetado (imprimir, mandar por WhatsApp) es del frontend.

```json
{
  "codigo": "EE2E-Y7J4",
  "numeros": ["07", "23", "45", "88"],
  "comprador": { "nombre": "Dora Silva", "telefono": "351-9876" },
  "sorteo": { "periodo": "2026-08", "estado": "abierto" },
  "importe": 600,
  "vendedor": "Vendedor Uno",
  "fecha": "2026-07-30T22:02:14.006Z",
  "anulada": false
}
```

`GET /jugadas/comprobante/:codigo` lo recupera después, para cuando el comprador
se presenta con el papel en la mano. Acepta el código con o sin guion y en
minúsculas. Si el sorteo ya está finalizado, agrega `sorteado: true` y `gano`.

### Dashboard (todo admin)
| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/dashboard/resumen` | Estado del sorteo, pozo y totales |
| GET | `/dashboard/por-vendedor` | Jugadas y recaudación por vendedor |
| GET | `/dashboard/ventas` | Serie diaria para el gráfico de evolución |
| GET | `/dashboard/historial` | Sorteos finalizados, ganadores y reparto |
| GET | `/dashboard/numeros-mas-jugados` | Combinaciones más repetidas |

## Lo que hay que tener en cuenta al tocar esto

**El orden de los números no importa.** Se guardan siempre ordenados
ascendentemente, tanto en la jugada como en el resultado del sorteo. Por eso
`[45,7,88,23]` y `[7,23,45,88]` son la misma jugada, y el match de ganadores
puede seguir siendo una comparación posicional barata que usa el índice.

Toda normalización pasa por `src/utils/numeros.js`. Los `CHECK` de la base son la
red de seguridad: si alguien inserta sin normalizar, el INSERT falla en vez de
guardar una jugada que nunca podría ganar.

**Los permisos se validan acá, no en el frontend.** El filtro por vendedor en
`GET /jugadas` se impone en el servidor: un vendedor que mande `?vendedor_id=3`
sigue viendo solo lo suyo.

**Anular no borra.** Se marca la fila y se registra qué admin lo hizo y cuándo.

**El código de comprobante lo genera Postgres, no Node.** Está como `DEFAULT` de
la columna, así que no hay forma de insertar una jugada sin comprobante y el
formato vive en un solo lugar (`generar_codigo_jugada()`, migración 002). Si
alguna vez se cambia el alfabeto, hay que cambiarlo también en `ALFABETO` de
`src/utils/comprobante.js`, que es lo que valida la entrada.

**El pozo se congela al finalizar.** Mientras el sorteo está abierto se calcula en
vivo; al cargar el resultado se persiste en `sorteos.pozo_total` para que anular
una jugada después no altere el histórico.

## Deploy en Render

- Build: `npm install`
- Start: `npm start`
- Variables: las de `.env.example`, con `DATABASE_SSL=true` y `CORS_ORIGIN`
  apuntando al dominio de Vercel.
- Las migraciones se corren a mano con `npm run migrate` (no en el arranque, para
  que un redeploy no toque el esquema sin querer).
- El free tier duerme el servicio sin tráfico: el primer request después de un
  rato puede tardar bastante.
