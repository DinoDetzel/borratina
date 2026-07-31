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

| Rol | Usuario | Contraseña |
|---|---|---|
| admin | `admin` | `admin1234` |
| vendedor | `vendedor1` | `vende1234` |
| vendedor | `vendedor2` | `vende1234` |

## Endpoints

Todo cuelga de `/api`. Salvo `login` y `health`, todos piden
`Authorization: Bearer <token>`.

### Auth
| Método | Ruta | Rol | Qué hace |
|---|---|---|---|
| POST | `/auth/login` | — | `{ usuario, password }` → `{ token, usuario }` |
| GET | `/auth/me` | cualquiera | Datos del usuario logueado |
| GET | `/auth/usuarios` | admin | Lista usuarios |
| POST | `/auth/usuarios` | admin | Da de alta un vendedor o admin |
| PATCH | `/auth/usuarios/:id/activo` | admin | Activa o desactiva una cuenta |

### Sorteos
| Método | Ruta | Rol | Qué hace |
|---|---|---|---|
| GET | `/sorteos` | cualquiera | Todos los sorteos |
| GET | `/sorteos/actual` | cualquiera | El sorteo abierto, con su pozo y lo recaudado |
| GET | `/sorteos/:id` | cualquiera | Un sorteo |
| POST | `/sorteos` | admin | Abre el sorteo (período, pozo, precio, ventana de carga) |
| PATCH | `/sorteos/:id/pozo` | admin | Corrige el pozo (solo con la carga abierta) |
| PATCH | `/sorteos/:id/ventana` | admin | Corrige las fechas de carga (solo con la carga abierta) |
| PATCH | `/sorteos/:id/cerrar` | admin | Corta la carga de jugadas |
| POST | `/sorteos/:id/resultado` | admin | Carga el resultado y finaliza |
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
  "codigo": "260815-K7M3XQ",
  "numeros": ["07", "23", "45", "88"],
  "comprador": { "nombre": "Dora Silva", "telefono": "351-9876" },
  "sorteo": { "periodo": "2026-08", "estado": "abierto" },
  "importe": 2000,
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

**Se gana con 4 dentro de 20.** El sorteo guarda el extracto oficial completo
(20 números) y gana la jugada cuyos 4 números están ahí dentro. El orden no
importa en ninguno de los dos lados.

**Los repetidos cuentan.** La contención es de multiconjunto: si la jugada repite
un número, el extracto tiene que repetirlo también. Con un solo `07` en el
extracto, la jugada `07 07 23 45` **no** gana.

La regla vive en `src/utils/ganadores.js` en dos formas que tienen que dar siempre
lo mismo: `condicionGanadora()` (SQL, para las queries) y `esGanadora()` (JS, para
cuando los datos ya están en memoria). Si se toca una, hay que tocar la otra.

**Los 4 números de la jugada se guardan ordenados ascendentemente**; el extracto
no, porque se publica en un orden propio que conviene conservar. La normalización
de las jugadas pasa por `src/utils/numeros.js`, y el `CHECK` de la base es la red
de seguridad si alguien inserta sin normalizar.

**Los permisos se validan acá, no en el frontend.** El filtro por vendedor en
`GET /jugadas` se impone en el servidor: un vendedor que mande `?vendedor_id=3`
sigue viendo solo lo suyo.

Lo mismo vale para los **totales**: `GET /sorteos/actual` devuelve `mis_jugadas`
a todos, pero `jugadas_cargadas` y `recaudacion` (que son de todo el sorteo) solo
al admin. Un vendedor no tiene por qué enterarse de cuánto vendieron los demás.

**Se entra con nombre de usuario, no con email.** Son pocos vendedores y las
cuentas las crea el admin, así que pedir un email para entrar era burocracia. El
email quedó como dato de contacto **opcional**. El usuario se normaliza a
minúsculas al crear la cuenta y al buscarla, así que `Dino` y `dino ` entran
igual.

**Anular no borra.** Se marca la fila y se registra qué admin lo hizo y cuándo.

**El código de comprobante lo genera Postgres, no Node.** El formato es
`AAMMDD-XXXXXX`: los primeros seis dígitos son la fecha de carga, los últimos seis
son aleatorios. Lo pone un trigger `BEFORE INSERT` (`generar_codigo_jugada()`,
migración 004) y no un `DEFAULT`, porque depende de `created_at` y un `DEFAULT` no
puede leer otra columna de la misma fila. Así no hay forma de insertar una jugada
sin comprobante y el formato vive en un solo lugar.

Si alguna vez se cambia el alfabeto, hay que cambiarlo también en `ALFABETO` de
`src/utils/comprobante.js`, que es lo que valida la entrada. Ojo con validar el
código entero contra el alfabeto: la parte de la fecha lleva `0` y `1`, que el
alfabeto no incluye, así que cada mitad se valida por separado.

**La ventana de carga la hace cumplir la base, no el frontend.** El
`INSERT ... SELECT` de `POST /jugadas` incluye
`now() BETWEEN s.inicia_at AND s.finaliza_at`, así que la condición se evalúa con
el reloj de Postgres y en la misma sentencia que escribe: no hay forma de que se
cuele una jugada entre el chequeo y el insert. El frontend deshabilita el botón,
pero eso es comodidad.

Cuando el insert no engancha ningún sorteo, `errorDeCarga()` consulta recién ahí
por qué (no hay sorteo / todavía no abrió / ya cerró) para dar un mensaje útil sin
pagar esa consulta en cada carga exitosa.

**El pozo es fijo, no se calcula.** Lo define el admin al abrir el sorteo y no
depende de cuánto se venda: con un pozo de $1.500.000 y dos ganadores, cobran
$750.000 cada uno aunque se hayan vendido tres jugadas. Solo se puede corregir
mientras la carga esté abierta.

**Pozo y recaudación son dos números distintos.** `recaudación = jugadas no
anuladas × precio_jugada`, y `resultado = recaudación − pozo` es lo que gana o
pierde el organizador. El dashboard los muestra separados a propósito: si se
vende poco, el premio se paga igual.

## Deploy en Render

- Build: `npm install`
- Start: `npm start`
- Variables: las de `.env.example`, con `DATABASE_SSL=true` y `CORS_ORIGIN`
  apuntando al dominio de Vercel.
- Las migraciones se corren a mano con `npm run migrate` (no en el arranque, para
  que un redeploy no toque el esquema sin querer).
- El free tier duerme el servicio sin tráfico: el primer request después de un
  rato puede tardar bastante.
