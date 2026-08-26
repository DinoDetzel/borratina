# memories/esquema-base-datos.md — Esquema de base de datos

> **Estado: v3.** El ajuste pendiente del borrador v1 quedó resuelto: el usuario
> confirmó que **el orden de los números no importa**, así que los 4 números se
> guardan normalizados en orden ascendente. La v3 agrega el **código de
> comprobante** de cada jugada.
>
> La fuente de verdad ejecutable son las migraciones en
> `backend/db/migrations/`; este documento explica el porqué de cada decisión.

## Migraciones

| Archivo | Qué agrega |
|---|---|
| `001_init.sql` | Esquema base: usuarios, sorteos, jugadas, índices |
| `002_codigo_comprobante.sql` | `jugadas.codigo`: identificador único del comprobante |
| `003_usuario_login.sql` | `usuarios.usuario`: credencial de ingreso; el email pasa a opcional |
| `004_codigo_con_fecha.sql` | El código del comprobante pasa a `AAMMDD-XXXXXX` y lo pone un trigger |
| `005_pozo_fijo.sql` | `pozo_total` → `pozo`: deja de calcularse y pasa a definirse al abrir |
| `006_ventana_de_carga.sql` | `inicia_at` / `finaliza_at`: desde y hasta cuándo se puede cargar |
| `007_extracto_de_20.sql` | El resultado pasa de 4 números a un extracto de 20 |
| `008_password_actualizada.sql` | `password_actualizada_at`: invalida los tokens anteriores al cambio |
| `009_sin_email.sql` | Se elimina `usuarios.email` |
| `010_corregir_extracto.sql` | El extracto se puede corregir, y queda quién, cuándo y qué decía antes |
| `011_correccion_de_jugada.sql` | `jugadas.numeros_anteriores`: qué decía la jugada antes de corregirla |
| `012_fecha_del_codigo_en_hora_argentina.sql` | La fecha del código de comprobante se calcula en hora del club, no en UTC |

## El resultado es un extracto de 20

```sql
ALTER TABLE sorteos ADD COLUMN numeros SMALLINT[];
ALTER TABLE sorteos DROP COLUMN numero_1;  -- … hasta numero_4

ALTER TABLE sorteos ADD CONSTRAINT chk_sorteos_extracto CHECK (
    numeros IS NULL
    OR (array_length(numeros, 1) = 20 AND 0 <= ALL (numeros) AND 99 >= ALL (numeros))
);
```

- **Array y no 20 columnas**: `numero_1..numero_20` sería ilegible y no aporta nada,
  porque el orden del extracto no interviene en el match.
- El extracto **no se normaliza**: se guarda como salió publicado. Las jugadas sí
  se normalizan, que es lo que mantiene utilizable `idx_jugadas_numeros` para el
  buscador por combinación exacta.
- El match dejó de ser una comparación posicional y pasó a ser **contención de
  multiconjunto**. La condición vive en `backend/src/utils/ganadores.js` y se
  expresa por la negativa: no hay ningún número que la jugada repita más veces de
  las que salió.
- Los sorteos que estaban finalizados con el modelo viejo volvieron a `cerrado` sin
  resultado: un resultado de 4 no se puede convertir en uno de 20 sin inventar los
  16 que faltan.

## Ventana de carga

```sql
ALTER TABLE sorteos ADD COLUMN inicia_at   TIMESTAMPTZ NOT NULL;
ALTER TABLE sorteos ADD COLUMN finaliza_at TIMESTAMPTZ NOT NULL;
ALTER TABLE sorteos ADD CONSTRAINT chk_sorteos_ventana CHECK (finaliza_at > inicia_at);
```

- La condición se evalúa **en la base**, dentro del mismo `INSERT ... SELECT` que
  carga la jugada: `now() BETWEEN s.inicia_at AND s.finaliza_at`. Así no depende
  del reloj de quien hace el request, y no hay ventana de carrera entre chequear
  y escribir.
- `finaliza_at` (previsto) y `fecha_cierre_carga` (efectivo) **no son lo mismo**:
  el admin puede cerrar antes de tiempo, o dejar que la ventana venza sola.
- El backfill usó `created_at` como inicio y el último instante del mes del período
  como fin, que es lo que el período ya implicaba.

## El pozo es un dato, no un cálculo

```sql
ALTER TABLE sorteos RENAME COLUMN pozo_total TO pozo;
ALTER TABLE sorteos ALTER COLUMN pozo SET NOT NULL;
ALTER TABLE sorteos ADD CONSTRAINT chk_sorteos_pozo CHECK (pozo > 0);
```

- Se renombró porque el significado cambió: `pozo_total` sonaba a total calculado
  y ahora es un valor de entrada.
- `precio_jugada` **no** desapareció: sigue siendo lo que paga el comprador. Lo que
  cambió es que ya no determina el premio, así que **pozo y recaudación son dos
  números distintos** y su diferencia es lo que gana o pierde el organizador.
- Ya no hay que congelar nada al finalizar: el pozo fue fijo desde el principio.
- El backfill usó el cálculo viejo (`jugadas × precio`) para no inventar valores,
  con el precio de una jugada como piso para los sorteos sin ventas, que no
  habrían pasado el `CHECK`.

## Credencial de ingreso

```sql
ALTER TABLE usuarios ADD COLUMN usuario VARCHAR(30) NOT NULL;  -- backfill desde el email
ALTER TABLE usuarios ADD CONSTRAINT usuarios_usuario_key UNIQUE (usuario);
ALTER TABLE usuarios ADD CONSTRAINT chk_usuarios_usuario
    CHECK (usuario ~ '^[a-z0-9._-]{3,30}$');
ALTER TABLE usuarios ALTER COLUMN email DROP NOT NULL;
```

- El backfill toma la parte del email anterior al `@`, y desempata con el `id` si
  dos emails distintos comparten esa parte.
- El `CHECK` exige minúsculas; la normalización la hace la app antes de insertar.

**El email ya no existe** (migración 009, 2026-07-31). La 003 lo había dejado
como dato de contacto opcional; en la práctica quedaba siempre vacío, porque las
cuentas las da el admin en persona. Para dar de alta a un vendedor hacen falta
tres cosas: nombre, usuario y contraseña.

```sql
ALTER TABLE usuarios DROP COLUMN email;
```

## Código de comprobante

```sql
-- Alfabeto sin caracteres ambiguos: sin 0/O, sin 1/I/L, sin U.
CREATE OR REPLACE FUNCTION generar_codigo_jugada() RETURNS TEXT AS $$ ... $$;

ALTER TABLE jugadas
    ADD COLUMN codigo VARCHAR(9) NOT NULL DEFAULT generar_codigo_jugada();
ALTER TABLE jugadas
    ADD CONSTRAINT jugadas_codigo_key UNIQUE (codigo);
```

Formato actual (migración 004): **`AAMMDD-XXXXXX`**, donde los primeros seis
dígitos son la fecha de carga y los últimos seis son aleatorios.

Decisiones:
- **Lo genera la base, no la aplicación**, así el formato vive en un solo lugar y
  es imposible insertar una jugada sin comprobante.
- **Lo pone un trigger `BEFORE INSERT`, ya no un `DEFAULT`.** El código depende de
  `created_at`, que es otra columna de la misma fila, y un `DEFAULT` no puede
  leerla. El trigger corre después de aplicados los defaults, así que ya ve la
  fecha definitiva — incluso cuando se inserta un `created_at` explícito.
- **Aleatorio y no correlativo**: el `id` serial no sirve como comprobante porque
  se pueden adivinar los ajenos contando de a uno.
- Al ser aleatorio puede colisionar; el `UNIQUE` lo detecta y la ruta de carga
  reintenta. Con 30⁶ combinaciones **por día**, llegar al segundo intento es
  rarísimo.
- `normalizarCodigo()` en `src/utils/comprobante.js` acepta el código en
  minúsculas, sin guion y con separadores arbitrarios. Valida **las dos mitades
  por separado**: la fecha son seis dígitos donde el 0 y el 1 son legítimos,
  mientras que la parte aleatoria nunca los lleva. Validar el código entero
  contra el alfabeto rechazaría cualquier fecha con un cero.

> La migración 004 regeneró todos los códigos existentes. Fue aceptable porque
> todavía no se había entregado ningún comprobante real. **Una vez en uso, este
> tipo de migración deja de serlo**: invalidaría los papeles que la gente tiene
> en la mano.

## La fecha del código va en hora del club (migración 012)

`to_char()` sobre un `TIMESTAMPTZ` usa la zona de la sesión, y el Postgres corre
en UTC: una jugada cargada un domingo a las 21:55 se llevaba impreso el lunes.
Tres horas por día, todas las noches, que es justo cuando más se vende.

```sql
CREATE OR REPLACE FUNCTION generar_codigo_jugada(fecha TIMESTAMPTZ DEFAULT now())
RETURNS TEXT AS $$ ... to_char(fecha AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYMMDD') ... $$;
```

- **La zona va escrita dentro de la función**, no librada a la configuración de
  la sesión: el código sale impreso en un papel que la gente guarda para reclamar
  un premio y no puede depender de cómo arrancó el servidor. La sesión igual fija
  la zona (ver `src/db.js`), pero para todo lo demás — el agrupado por día del
  gráfico de ventas se corría igual.
- **Los códigos ya emitidos NO se tocaron**, al revés que en la 004. Para entonces
  el sistema ya estaba en uso y había comprobantes en manos de compradores. Uno
  con la fecha corrida sigue siendo válido: se busca por el código entero, que no
  cambió, y la fecha real de la venta está en `created_at`. Regenerarlos habría
  roto el papel.

## Cambios respecto de v1

| # | Cambio | Motivo |
|---|---|---|
| 1 | Números normalizados ascendentes + `CHECK` de orden | Orden libre confirmado: permite comparar como conjunto sin perder el índice |
| 2 | Mismo tratamiento en `sorteos` (resultado normalizado) | Ambos lados del match deben estar en la misma forma |
| 3 | Índice único parcial: un solo sorteo `abierto` a la vez | Regla de negocio, antes no estaba forzada |
| 4 | Auditoría de anulación (`anulada_at`) y edición (`editada_por`) | v1 tenía `updated_at` suelto sin saber quién tocó |
| 5 | `CHECK` de estados y roles válidos | v1 los dejaba como texto libre |
| 6 | `finalizado` exige resultado cargado; los 4 números van juntos o ninguno | Evita sorteos finalizados a medias |

## Tablas

> ⚠️ **Esto es el `001_init.sql`, no el esquema de hoy.** Se conserva como punto
> de partida: las secciones de arriba son los deltas que le aplicaron las
> migraciones 002 a 012. Leído solo, miente en varias cosas —`usuarios.email` ya
> no existe, `sorteos` no tiene `numero_1..4` sino `numeros` (20), y `pozo_total`
> se llama `pozo` y no se calcula—. **Para saber cómo está una tabla hoy, mirar
> las migraciones o la base.**

```sql
-- Vendedores y administradores
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    rol VARCHAR(20) NOT NULL DEFAULT 'vendedor',
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_usuarios_rol CHECK (rol IN ('vendedor', 'admin'))
);

-- Un sorteo por mes, compartido entre todos los vendedores
CREATE TABLE sorteos (
    id SERIAL PRIMARY KEY,
    periodo CHAR(7) NOT NULL UNIQUE,              -- 'AAAA-MM', ej: '2026-08'
    precio_jugada NUMERIC(10,2) NOT NULL CHECK (precio_jugada > 0),
    estado VARCHAR(20) NOT NULL DEFAULT 'abierto',
    -- Resultado oficial, normalizado ascendente. NULL hasta que el admin lo carga.
    numero_1 SMALLINT CHECK (numero_1 BETWEEN 0 AND 99),
    numero_2 SMALLINT CHECK (numero_2 BETWEEN 0 AND 99),
    numero_3 SMALLINT CHECK (numero_3 BETWEEN 0 AND 99),
    numero_4 SMALLINT CHECK (numero_4 BETWEEN 0 AND 99),
    fecha_cierre_carga DATE,
    fecha_resultado TIMESTAMPTZ,
    pozo_total NUMERIC(12,2),                     -- congelado al finalizar
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_sorteos_periodo CHECK (periodo ~ '^\d{4}-(0[1-9]|1[0-2])$'),
    CONSTRAINT chk_sorteos_estado CHECK (estado IN ('abierto', 'cerrado', 'finalizado')),
    -- Resultado normalizado ascendente (mismo criterio que las jugadas)
    CONSTRAINT chk_sorteos_orden CHECK (
        numero_1 <= numero_2 AND numero_2 <= numero_3 AND numero_3 <= numero_4
    ),
    -- Los 4 números se cargan juntos o ninguno
    CONSTRAINT chk_sorteos_resultado_completo CHECK (
        num_nulls(numero_1, numero_2, numero_3, numero_4) IN (0, 4)
    ),
    -- No se puede finalizar sin resultado
    CONSTRAINT chk_sorteos_finalizado CHECK (
        estado <> 'finalizado' OR numero_1 IS NOT NULL
    )
);

-- Como máximo un sorteo con la carga abierta en todo el sistema: al indexar de
-- forma única solo las filas con estado 'abierto', ese valor puede aparecer
-- una sola vez en toda la tabla.
CREATE UNIQUE INDEX idx_sorteo_abierto_unico
    ON sorteos (estado) WHERE estado = 'abierto';

-- Jugadas cargadas por vendedores
CREATE TABLE jugadas (
    id SERIAL PRIMARY KEY,
    sorteo_id INTEGER NOT NULL REFERENCES sorteos(id),
    vendedor_id INTEGER NOT NULL REFERENCES usuarios(id),
    comprador_nombre VARCHAR(150) NOT NULL,
    comprador_telefono VARCHAR(30),               -- opcional
    -- Los 4 números SIEMPRE se guardan ordenados ascendentemente.
    -- La app los normaliza antes del INSERT; el CHECK lo garantiza.
    numero_1 SMALLINT NOT NULL CHECK (numero_1 BETWEEN 0 AND 99),
    numero_2 SMALLINT NOT NULL CHECK (numero_2 BETWEEN 0 AND 99),
    numero_3 SMALLINT NOT NULL CHECK (numero_3 BETWEEN 0 AND 99),
    numero_4 SMALLINT NOT NULL CHECK (numero_4 BETWEEN 0 AND 99),

    anulada BOOLEAN NOT NULL DEFAULT false,
    anulada_por INTEGER REFERENCES usuarios(id),  -- admin que anuló
    anulada_at TIMESTAMPTZ,
    editada_por INTEGER REFERENCES usuarios(id),  -- admin que editó por última vez
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ,

    CONSTRAINT chk_jugadas_orden CHECK (
        numero_1 <= numero_2 AND numero_2 <= numero_3 AND numero_3 <= numero_4
    ),
    CONSTRAINT chk_jugadas_anulacion CHECK (
        (anulada = false AND anulada_por IS NULL AND anulada_at IS NULL)
     OR (anulada = true  AND anulada_por IS NOT NULL AND anulada_at IS NOT NULL)
    )
);

CREATE INDEX idx_jugadas_sorteo ON jugadas(sorteo_id);
CREATE INDEX idx_jugadas_vendedor ON jugadas(sorteo_id, vendedor_id);
CREATE INDEX idx_jugadas_numeros
    ON jugadas(sorteo_id, numero_1, numero_2, numero_3, numero_4)
    WHERE anulada = false;

-- Buscador de jugadas por nombre de comprador (dashboard admin)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_jugadas_comprador_trgm
    ON jugadas USING gin (comprador_nombre gin_trgm_ops);
```

## Normalización de números (clave del diseño)

Como el orden no importa, **los 4 números de la jugada** se guardan ordenados
ascendentemente. Eso es lo que mantiene utilizable `idx_jugadas_numeros` para
buscar por combinación exacta.

> El **extracto no se normaliza** desde la migración 007: se guarda como salió
> publicado. Lo que decía antes esta sección —que ambos lados iban normalizados y
> el match era posicional— valía con un resultado de 4 números. Ver "El resultado
> es un extracto de 20", más arriba.

```js
// backend/src/utils/numeros.js
const normalizar = (nums) => [...nums].sort((a, b) => a - b);

normalizar([45, 7, 88, 23]);  // → [7, 23, 45, 88]
normalizar([7, 23, 45, 88]);  // → [7, 23, 45, 88]  ← misma jugada
```

> ⚠️ **Invariante**: nada debe insertar en `jugadas` ni en `sorteos` sin normalizar
> antes. El `CHECK` de orden es la red de seguridad que hace fallar el INSERT si
> alguien se saltea `normalizar()`.

## El pozo no se calcula

Desde la migración 005 el pozo es un **dato de entrada**: lo define el admin al
abrir el sorteo y no depende de cuánto se venda. Ver "El pozo es un dato, no un
cálculo", más arriba.

Lo que sí se calcula es la **recaudación**, y es otro número:

```
recaudación = jugadas NO anuladas × precio_jugada
resultado   = recaudación − pozo        ← lo que gana o pierde el organizador
```

> Antes acá decía `pozo_total = jugadas × precio_jugada`, congelado al finalizar.
> Eso dejó de ser cierto con la 005 y la columna ni siquiera se llama así.

## Determinar ganadores

Gana la jugada no anulada cuyos 4 números están **contenidos en el extracto de 20
como multiconjunto** (los repetidos cuentan). La condición no se escribe a mano en
cada query: sale de `condicionGanadora('j', 's')` en
`backend/src/utils/ganadores.js`, que tiene además una gemela en JS, `esGanadora()`,
para cuando los datos ya están en memoria. **Si se toca una, hay que tocar la otra.**

```sql
SELECT j.*, u.nombre AS vendedor
FROM jugadas j
JOIN usuarios u ON u.id = j.vendedor_id
JOIN sorteos s ON s.id = j.sorteo_id
WHERE s.id = $1
  AND j.anulada = false
  AND <condicionGanadora('j', 's')>;
```

Si devuelve N filas → premio por ganador = `pozo / N`.
Si devuelve 0 filas → sorteo vacante.

> La versión anterior comparaba `j.numero_1 = s.numero_1` y así hasta el cuarto.
> Servía cuando el sorteo tenía 4 números; con el extracto de 20 (migración 007)
> el match dejó de ser posicional.

## Consultas de referencia para el dashboard del admin

> Son el **boceto** de cada consulta, no lo que corre hoy: las que se ejecutan
> están en `backend/src/routes/dashboard.routes.js` y traen más columnas. Se
> mantienen acá porque explican la forma de cada una.

**Recaudación del sorteo actual:**
```sql
SELECT s.precio_jugada, s.pozo,
       COUNT(j.id) AS jugadas,
       COUNT(j.id) * s.precio_jugada AS recaudacion
FROM sorteos s
LEFT JOIN jugadas j ON j.sorteo_id = s.id AND j.anulada = false
WHERE s.id = $1
GROUP BY s.id, s.precio_jugada, s.pozo;
```
> `LEFT JOIN` a propósito: un sorteo recién abierto sin jugadas debe devolver 0,
> no una fila vacía (bug del v1, que usaba `JOIN`).
>
> El **pozo se lee de la columna**, no se calcula: es un dato de entrada desde la
> migración 005. Antes esta query lo devolvía como `pozo_actual` multiplicando.

**Jugadas y recaudación por vendedor (de un sorteo):**
```sql
SELECT u.id, u.nombre, COUNT(j.id) AS cantidad_jugadas,
       COUNT(j.id) * s.precio_jugada AS recaudacion
FROM jugadas j
JOIN usuarios u ON u.id = j.vendedor_id
JOIN sorteos s ON s.id = j.sorteo_id
WHERE j.sorteo_id = $1 AND j.anulada = false
GROUP BY u.id, u.nombre, s.precio_jugada
ORDER BY cantidad_jugadas DESC;
```

**Historial de sorteos y ganadores:**
```sql
SELECT s.periodo, s.numeros, s.pozo, COUNT(j.id) AS cantidad_ganadores
FROM sorteos s
LEFT JOIN jugadas j ON j.sorteo_id = s.id AND j.anulada = false
    AND <condicionGanadora('j', 's')>
WHERE s.estado = 'finalizado'
GROUP BY s.id
ORDER BY s.periodo DESC;
```

**Buscador de jugadas (por número o comprador):**
```sql
-- por número: los 4 números del filtro se normalizan en la app antes de la query,
-- que es lo que deja usar idx_jugadas_numeros
SELECT * FROM jugadas
WHERE sorteo_id = $1 AND anulada = false
  AND numero_1 = $2 AND numero_2 = $3 AND numero_3 = $4 AND numero_4 = $5;

-- por nombre de comprador (usa idx_jugadas_comprador_trgm)
SELECT * FROM jugadas
WHERE sorteo_id = $1 AND anulada = false
  AND comprador_nombre ILIKE '%' || $2 || '%';
```

**Evolución de ventas en el tiempo (por día, dentro de un sorteo):**
```sql
SELECT date_trunc('day', created_at) AS dia, COUNT(*) AS jugadas_del_dia
FROM jugadas
WHERE sorteo_id = $1 AND anulada = false
GROUP BY dia
ORDER BY dia;
```
> `date_trunc` sobre un `timestamptz` corta el día **en la zona de la sesión**.
> Por eso el pool la fija en la del club (`src/db.js`): con el Postgres en UTC,
> las ventas de después de las 21 se iban al día siguiente.

## Flujo general

1. Admin abre un sorteo nuevo del mes (`sorteos`, estado `abierto`), y ahí define
   el **pozo**, el precio de la jugada y la **ventana de carga**.
   El índice único parcial impide abrir un segundo sorteo si ya hay uno abierto.
2. Vendedores (logueados con JWT) cargan jugadas mientras el sorteo esté `abierto`
   **y la ventana esté vigente** — las dos condiciones se evalúan dentro del
   `INSERT`. Los números se normalizan antes de insertar.
3. Admin cierra la carga (estado `cerrado`), o la ventana vence sola.
4. Sale el extracto oficial de quiniela → el admin carga los 20 números a mano,
   **sin normalizar** → estado `finalizado`, y se calculan ganadores y reparto
   sobre el pozo, que era fijo desde el paso 1.

Reglas del juego en [[reglas-de-negocio]]. Permisos por endpoint en [[tech-stack]].
