# memories/esquema-base-datos.md — Esquema de base de datos

> **Estado: v2 — CERRADO.** El ajuste pendiente del borrador v1 quedó resuelto:
> el usuario confirmó que **el orden de los números no importa**. Los 4 números se
> guardan normalizados en orden ascendente. Este esquema está implementado en
> `backend/db/migrations/001_init.sql`, que es ahora la fuente de verdad ejecutable.

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

Como el orden no importa, tanto la jugada como el resultado se guardan **ordenados
ascendentemente**. Así el match se reduce a una comparación posicional trivial que
sigue usando `idx_jugadas_numeros`.

```js
// backend/src/utils/numeros.js
const normalizar = (nums) => [...nums].sort((a, b) => a - b);

normalizar([45, 7, 88, 23]);  // → [7, 23, 45, 88]
normalizar([7, 23, 45, 88]);  // → [7, 23, 45, 88]  ← misma jugada
```

> ⚠️ **Invariante**: nada debe insertar en `jugadas` ni en `sorteos` sin normalizar
> antes. El `CHECK` de orden es la red de seguridad que hace fallar el INSERT si
> alguien se saltea `normalizar()`.

## Cálculo del pozo

```
pozo_total = cantidad_jugadas_no_anuladas × precio_jugada
```

En vivo mientras el sorteo está abierto; se persiste en `sorteos.pozo_total` al
finalizarlo para congelar el histórico.

## Determinar ganadores

```sql
SELECT j.*, u.nombre AS vendedor
FROM jugadas j
JOIN usuarios u ON u.id = j.vendedor_id
JOIN sorteos s ON s.id = j.sorteo_id
WHERE s.id = $1
  AND j.anulada = false
  AND j.numero_1 = s.numero_1
  AND j.numero_2 = s.numero_2
  AND j.numero_3 = s.numero_3
  AND j.numero_4 = s.numero_4;
```

Funciona como comparación de conjuntos porque **ambos lados están normalizados**.

Si devuelve N filas → premio por ganador = `pozo_total / N`.
Si devuelve 0 filas → sorteo vacante.

## Consultas de referencia para el dashboard del admin

**Pozo acumulado del sorteo actual:**
```sql
SELECT s.precio_jugada,
       COUNT(j.id) AS jugadas,
       COUNT(j.id) * s.precio_jugada AS pozo_actual
FROM sorteos s
LEFT JOIN jugadas j ON j.sorteo_id = s.id AND j.anulada = false
WHERE s.id = $1
GROUP BY s.id, s.precio_jugada;
```
> `LEFT JOIN` a propósito: un sorteo recién abierto sin jugadas debe devolver pozo 0,
> no una fila vacía (bug del v1, que usaba `JOIN`).

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
SELECT s.periodo, s.numero_1, s.numero_2, s.numero_3, s.numero_4,
       s.pozo_total, COUNT(j.id) AS cantidad_ganadores
FROM sorteos s
LEFT JOIN jugadas j ON j.sorteo_id = s.id AND j.anulada = false
    AND j.numero_1 = s.numero_1 AND j.numero_2 = s.numero_2
    AND j.numero_3 = s.numero_3 AND j.numero_4 = s.numero_4
WHERE s.estado = 'finalizado'
GROUP BY s.id
ORDER BY s.periodo DESC;
```

**Buscador de jugadas (por número o comprador):**
```sql
-- por número: los 4 números del filtro se normalizan en la app antes de la query
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

## Flujo general

1. Admin abre un sorteo nuevo del mes (`sorteos`, estado `abierto`).
   El índice único parcial impide abrir un segundo sorteo si ya hay uno abierto.
2. Vendedores (logueados con JWT) cargan jugadas mientras el sorteo esté `abierto`.
   Los números se normalizan antes de insertar.
3. Admin cierra la carga (estado `cerrado`).
4. Sale el resultado oficial de quiniela → admin lo carga a mano (normalizado) →
   estado `finalizado`, se congela `pozo_total` y se calculan ganadores y reparto.

Reglas del juego en [[reglas-de-negocio]]. Permisos por endpoint en [[tech-stack]].
