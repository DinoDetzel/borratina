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

## Tests

```bash
npm test                                        # node --test test/
TEST_DATABASE_URL=postgresql://... npm test     # + los tests de rutas
```

Corren con el runner de Node (`node:test`), sin dependencias agregadas.

Cubren lo que **no** se puede revisar a ojo: la regla de quién gana, la
normalización de los números, el código de comprobante y el freno de intentos de
login.

### Tests de rutas

`test/rutas.test.js` levanta la API de verdad y verifica los permisos y los
candados de estado: que un vendedor con `?vendedor_id=3` siga viendo solo lo
suyo, que una jugada ajena dé 404 y no 403, que el dashboard sea del admin, que
no se abran dos sorteos a la vez, y que con el extracto cargado no se puedan
cambiar los números ni restaurar una anulada —pero sí anular, y sí corregir el
nombre del comprador—.

Son reglas que viven en un `WHERE` y en un `if`: ningún `CHECK` de la base las
respalda, y se rompen sin que falle nada. Son también las que el `.rules`
argumenta con más cuidado, así que eran justo las que convenía atar.

**Piden `TEST_DATABASE_URL` con una base descartable.** Estos tests escriben:
crean cuentas, abren un sorteo y lo finalizan. Van detrás de su propia variable
para que no haya forma de correrlos sin querer contra Supabase. La base necesita
las migraciones corridas y **ningún sorteo abierto** (el índice único parcial no
deja abrir un segundo). Sin la variable, o si no responde, se saltean.

Con Docker, alcanza con el Postgres de más arriba:

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/borratina npm test
```

### En CI no se saltea nada

`.github/workflows/ci.yml` levanta un Postgres de servicio y pasa las dos
variables. Y **cuando `CI` está puesta, los tests que dependen de la base fallan
en vez de saltearse**: un `describe` salteado registra *cero* tests, no tests
salteados, así que sin ese freno la suite adelgazaba en silencio y el build
quedaba verde con la mitad muda. Local se siguen salteando, que es lo correcto.

El workflow corre además las migraciones dos veces, para verificar que el runner
sea idempotente como promete.

**Lo importante es `test/ganadores.test.js`.** La regla vive escrita dos veces
—`condicionGanadora()` en SQL y `esGanadora()` en JS— y nada en el sistema avisa
si se separan: el listado usa una y el comprobante la otra, así que una jugada
podría figurar ganadora en la pantalla y perdedora en el papel. El bloque de
paridad corre **las dos sobre los mismos casos y compara**, incluidas 200
combinaciones al azar sobre un rango chico, que es donde aparecen los repetidos.

Ese bloque necesita un Postgres de verdad, porque la mitad SQL depende de `<@` y
`unnest`. Si no hay `DATABASE_URL` los tests de paridad **se saltean** en vez de
fallar: el resto de la suite no tiene por qué exigir una base. Los datos van por
`VALUES`, así que no tocan ninguna tabla — alcanza con que la base exista, ni
siquiera hace falta correr las migraciones.

## Endpoints

Todo cuelga de `/api`. Salvo `login` y `health`, todos piden
`Authorization: Bearer <token>`.

### Auth
| Método | Ruta | Rol | Qué hace |
|---|---|---|---|
| POST | `/auth/login` | — | `{ usuario, password }` → `{ token, usuario }`. Frenado a 10 fallos por cuenta |
| GET | `/auth/me` | cualquiera | Datos del usuario logueado |
| GET | `/auth/usuarios` | admin | Lista usuarios |
| POST | `/auth/usuarios` | admin | Da de alta un vendedor o admin |
| PATCH | `/auth/usuarios/:id` | admin | Corrige nombre, usuario o rol |
| PATCH | `/auth/usuarios/:id/password` | admin | Le pone una contraseña nueva |
| PATCH | `/auth/usuarios/:id/activo` | admin | Activa o desactiva una cuenta |
| DELETE | `/auth/usuarios/:id` | admin | Borra la cuenta, si no dejó rastro |

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
| POST | `/sorteos/:id/resultado` | admin | Carga el extracto y finaliza |
| PATCH | `/sorteos/:id/resultado` | admin | Corrige el extracto ya cargado |
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
| POST | `/jugadas/:id/restaurar` | admin | Revierte una anulación (no, si el sorteo ya se finalizó) |

Filtros de `GET /jugadas`: `sorteo_id`, `vendedor_id` (solo admin), `comprador`,
`codigo`, `numeros` (ej: `numeros=7,23,45,88`), `incluir_anuladas`,
`solo_ganadoras`, `limit`, `offset`.

Cada jugada del listado trae `gano`, que es **`null` mientras el sorteo no esté
finalizado** — distinto de `false`. Con un extracto de 20 números no hay forma de
compararlo a ojo, así que el dato viene resuelto desde la base.

Las anuladas traen además `anulada_por_nombre`, que sale de un `LEFT JOIN` sobre
`usuarios`. `anulada_por` a secas es un id y en pantalla no le dice nada a nadie:
con varios admins, lo que hace falta saber es quién fue.

`solo_ganadoras=true` es la lista con la que se pagan los premios: excluye las
anuladas aunque sus números coincidan.

#### Comprobante

`POST /jugadas` devuelve `{ jugada, comprobante }`. El comprobante son datos, no
HTML: el maquetado (imprimir, mandar por WhatsApp) es del frontend.

```json
{
  "codigo": "260815-K7M3XQ",
  "numeros": ["07", "23", "45", "88"],
  "comprador": { "nombre": "Dora Silva", "telefono": "351-9876" },
  "sorteo": {
    "periodo": "2026-08",
    "estado": "abierto",
    "pozo": 1500000,
    "sortea_el": "2026-08-31T23:59:00.000Z"
  },
  "importe": 2000,
  "vendedor": "Vendedor Uno",
  "fecha": "2026-07-30T22:02:14.006Z",
  "anulada": false
}
```

El comprobante incluye el **pozo**: es el premio que el comprador está comprando
y tiene que quedarle por escrito en el papel.

`sortea_el` es el cierre de la ventana de carga (`finaliza_at`), que es el día en
que se sortea. Va la fecha completa y el frontend imprime solo el día: la hora del
cierre es asunto interno y en el papel no significa nada.

Los cuatro últimos campos —`periodo`, `estado`, `vendedor` y `fecha`— **no se
imprimen en el ticket**: van en el payload y las dos maquetas los ignoran. Están
para quien arme otra vista.

`GET /jugadas/comprobante/:codigo` lo recupera después, para cuando el comprador
se presenta con el papel en la mano. Acepta el código con o sin guion y en
minúsculas. Es lo que consume la pantalla **Consultar comprobante**, que está
para los dos roles.

Si el sorteo ya está finalizado agrega `sorteado: true` y `gano`, y **cuando esa
jugada gana** también `cantidad_ganadores` y `premio`. Con el pozo fijo, el
premio depende de entre cuántos se reparte, así que decir "ganaste" sin el monto
deja a medias la pregunta que el comprador va a hacer igual. El recuento se paga
solo en ese caso: una consulta cualquiera no lo dispara, y `null` ahí no
significa cero ganadores sino que no hace falta.

### Dashboard (todo admin)
| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/dashboard/resumen` | Estado del sorteo, pozo y totales |
| GET | `/dashboard/por-vendedor` | Jugadas y recaudación por vendedor (los que cargaron) |
| GET | `/dashboard/vendedores` | Todas las cuentas, hayan cargado o no |
| GET | `/dashboard/ventas` | Serie diaria para el gráfico de evolución |
| GET | `/dashboard/historial` | Sorteos finalizados, ganadores y reparto |
| GET | `/dashboard/numeros-mas-jugados` | Combinaciones más repetidas |

Todos aceptan `?sorteo_id=`; sin él usan el sorteo abierto, y si no hay ninguno,
el más reciente.

`por-vendedor` y `vendedores` contestan preguntas opuestas. El primero es el
podio del panel: quién más cargó. El segundo es la lista entera —incluidas las
cuentas inactivas, las del admin y las que **no cargaron nada**— porque ahí la
pregunta es quién *no* está vendiendo, y un ausente es el dato. Trae además el
total histórico y la última carga de cada cuenta, para distinguir al que nunca
cargó nada del que este mes no cargó.

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

**Una cuenta es nombre, usuario y contraseña.** No hay email: se entra con el
nombre de usuario, y las cuentas las crea el admin en persona, así que el email
no servía ni para entrar ni para avisar nada. La columna existió hasta la
migración 009. El usuario se normaliza a minúsculas al crear la cuenta y al
buscarla, así que `Dino` y `dino ` entran igual.

**Después del sorteo no se tocan los números de una jugada.** `PATCH /jugadas/:id`
rechaza el cambio de números si el sorteo está finalizado. Con el extracto a la
vista, corregir una jugada es elegir quién gana: alcanzaba con copiarle los
números al extracto para convertir un sorteo vacante en un premio cobrado. El
nombre y el teléfono del comprador se corrigen siempre, porque no cambian quién
gana y hay que poder arreglar un apellido mal escrito cuando el comprador se
presenta a cobrar.

La condición viaja dentro del `UPDATE` (`EXISTS ... estado <> 'finalizado'`) y no
en un chequeo previo, por lo mismo que la ventana de carga: si el extracto se
carga justo entre la lectura y la escritura, no se cuela una corrección con el
resultado ya a la vista.

Antes del sorteo la corrección es legítima —nadie sabe qué va a salir— y guarda
`numeros_anteriores` (migración 011): una corrección no puede pisar el dato en
silencio, porque si alguien discute que sus números eran otros hay que tener con
qué contestarle.

**El extracto se puede corregir, y queda registrado.** Son 20 números que alguien
tipea leyendo la pizarra: un dedazo en uno solo cambia quién cobra, así que
`PATCH /sorteos/:id/resultado` permite arreglarlo aunque el sorteo esté
finalizado. La corrección guarda quién la hizo, cuándo, y el extracto anterior
(`resultado_corregido_por`, `resultado_corregido_at`, `numeros_anteriores`).

La respuesta trae `ganadores_antes` y `dejaron_de_ganar` además de los ganadores
nuevos. Eso último es lo que de verdad se necesita: a quién hay que avisarle que
ya no cobra. Que lo calcule el backend evita que alguien compare dos listas a ojo
justo cuando importa.

**Anular no borra.** Se marca la fila y se registra qué admin lo hizo y cuándo.

**El historial de anulaciones vive en `jugadas_eventos`** (migración 013), no en
`jugadas`. Es que son dos preguntas distintas: `jugadas.anulada_por` dice **quién
la tiene anulada hoy** —y el `CHECK` obliga a limpiarla al restaurar, así que se
pierde— mientras que la tabla de eventos dice **qué le fue pasando**, y eso
sobrevive a las restauraciones. Sin ella, anular y restaurar no dejaba huella.

Anular y restaurar escriben su evento **dentro de la misma transacción** que el
`UPDATE`: un historial al que a veces le falta una entrada no sirve como
historial. Si agregás otra operación que cambie `anulada`, tiene que anotar su
evento igual, o el historial vuelve a mentir.

`GET /jugadas/:id` devuelve el `historial` **solo al admin**. El listado no lo
trae entero —serían N consultas— pero sí `veces_anulada`, que es lo que permite
distinguir una jugada activa que estuvo anulada de una que nunca se tocó.

**Una cuenta con historial no se borra, se desactiva.** `DELETE
/auth/usuarios/:id` solo pasa si esa cuenta no cargó, no anuló y no corrigió
ninguna jugada; si tocó algo, responde 409 y sugiere desactivarla. Borrarla sería
llevarse puesto el historial: las jugadas quedan a nombre de quien las cargó, y
una cuenta desactivada no puede entrar igual. Sirve, en la práctica, para deshacer
un alta recién hecha con un error de tipeo.

**Cambiar una contraseña cierra las sesiones abiertas.** El admin no necesita la
contraseña anterior (nadie la tiene: en la base solo queda el hash), así que el
reset sería inútil como medida de seguridad si el token viejo siguiera valiendo.
Por eso `usuarios.password_actualizada_at` (migración 008) se compara contra el
`iat` del token en `requireAuth`. La fecha se trunca a segundos antes de comparar,
porque `iat` viene en segundos: si no, un login en el mismo segundo que el cambio
se rechazaría a sí mismo.

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

**El día se decide en la hora del club, no en la del servidor.** Postgres corre en
UTC y ahí todo lo que pase un `timestamptz` a fecha se corre tres horas: una
jugada de las 21:30 de un martes cae en el miércoles. Eso salía impreso en el
código del comprobante y también movía de día las ventas del gráfico.

Se arregla en dos lugares y los dos hacen falta:

- El **pool** le pasa `-c timezone=…` a cada conexión (`src/db.js`), tomándolo de
  `config.zonaHoraria` (`TZ_CLUB`, por defecto Buenos Aires). Eso cubre el
  `date_trunc('day', …)` del gráfico y cualquier otra lectura por día.
- La función `generar_codigo_jugada()` lleva la zona **escrita adentro**
  (migración 012), no librada a la sesión: ese código sale impreso en un papel que
  la gente guarda para reclamar un premio y no puede depender de cómo arrancó el
  servidor.

Nada de esto cambia lo que se guarda —las fechas entran en ISO con `Z`— solo cómo
se lee de vuelta. Y **los códigos ya emitidos no se regeneraron**: para la 012 el
sistema ya estaba en uso. Uno con la fecha corrida sigue siendo válido, porque se
busca por el código entero y la fecha real está en `created_at`.

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

**El login se frena por cuenta, no por IP.** A los 10 fallos seguidos, esa cuenta
queda 15 minutos sin poder entrar (429). Sin eso, la única barrera para probar
contraseñas es lo que tarda bcrypt —unos 70 ms— y las contraseñas las pone el
admin a mano, así que son cortas.

Se cuenta por usuario a propósito: los vendedores comparten la red del club y los
datos móviles, así que por IP un solo atacante los dejaría a **todos** afuera en
pleno horario de venta. Además, detrás del proxy de Render `req.ip` es el del
proxy salvo que se configure `trust proxy`, y mal puesto el bloqueo nace siendo
global. Lo que hay que frenar —probar contraseñas contra una cuenta concreta— no
se esquiva cambiando de IP.

Un usuario que no existe también cuenta: si no, probar nombres inventados sería
gratis y el freno delataría cuáles están registrados. Acertar la contraseña
limpia el contador. El estado vive en memoria (`src/utils/intentos-de-login.js`)
y se pierde en cada redeploy, que con una sola instancia en Render alcanza.

Lo que **no** cubre: probar una misma contraseña contra muchas cuentas distintas.
Ahí haría falta un segundo freno por IP, y entonces sí hay que configurar
`trust proxy` primero.

## Deploy en Render

- Build: `npm install`
- Start: `npm start`
- Variables: las de `.env.example`, con `DATABASE_SSL=true` y `CORS_ORIGIN`
  apuntando al dominio de Vercel.
- Las migraciones se corren a mano con `npm run migrate` (no en el arranque, para
  que un redeploy no toque el esquema sin querer).
- El free tier duerme el servicio sin tráfico: el primer request después de un
  rato puede tardar bastante.
