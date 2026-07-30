-- 001_init.sql — Esquema inicial de la borratina digital.
-- Corresponde a la v2 documentada en .rules/memories/esquema-base-datos.md.
--
-- Decisión central: el orden de los 4 números NO importa. Se guardan siempre
-- ordenados ascendentemente (la app normaliza; los CHECK lo garantizan), de modo
-- que "mismo conjunto de números" se resuelve con una comparación posicional
-- que aprovecha el índice compuesto.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Vendedores y administradores.
CREATE TABLE usuarios (
    id            SERIAL PRIMARY KEY,
    nombre        VARCHAR(100) NOT NULL,
    email         VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    rol           VARCHAR(20) NOT NULL DEFAULT 'vendedor',
    activo        BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_usuarios_rol CHECK (rol IN ('vendedor', 'admin'))
);

-- Un sorteo por mes, compartido por todos los vendedores.
CREATE TABLE sorteos (
    id                 SERIAL PRIMARY KEY,
    periodo            CHAR(7) NOT NULL UNIQUE,   -- 'AAAA-MM'
    precio_jugada      NUMERIC(10,2) NOT NULL CHECK (precio_jugada > 0),
    estado             VARCHAR(20) NOT NULL DEFAULT 'abierto',

    -- Resultado oficial de la quiniela, normalizado. NULL hasta que lo carga el admin.
    numero_1           SMALLINT CHECK (numero_1 BETWEEN 0 AND 99),
    numero_2           SMALLINT CHECK (numero_2 BETWEEN 0 AND 99),
    numero_3           SMALLINT CHECK (numero_3 BETWEEN 0 AND 99),
    numero_4           SMALLINT CHECK (numero_4 BETWEEN 0 AND 99),

    fecha_cierre_carga TIMESTAMPTZ,
    fecha_resultado    TIMESTAMPTZ,
    pozo_total         NUMERIC(12,2),             -- se congela al finalizar
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_sorteos_periodo CHECK (periodo ~ '^\d{4}-(0[1-9]|1[0-2])$'),
    CONSTRAINT chk_sorteos_estado  CHECK (estado IN ('abierto', 'cerrado', 'finalizado')),

    -- Resultado normalizado ascendente, igual criterio que las jugadas.
    CONSTRAINT chk_sorteos_orden CHECK (
        numero_1 <= numero_2 AND numero_2 <= numero_3 AND numero_3 <= numero_4
    ),
    -- Los 4 números se cargan juntos o ninguno.
    CONSTRAINT chk_sorteos_resultado_completo CHECK (
        num_nulls(numero_1, numero_2, numero_3, numero_4) IN (0, 4)
    ),
    -- No se puede finalizar sin resultado.
    CONSTRAINT chk_sorteos_finalizado CHECK (
        estado <> 'finalizado' OR numero_1 IS NOT NULL
    )
);

-- Como máximo un sorteo con la carga abierta en todo el sistema: al indexar de
-- forma única solo las filas con estado 'abierto', el valor 'abierto' puede
-- aparecer una sola vez en toda la tabla.
CREATE UNIQUE INDEX idx_sorteo_abierto_unico
    ON sorteos (estado) WHERE estado = 'abierto';

-- Jugadas cargadas por los vendedores.
CREATE TABLE jugadas (
    id                 SERIAL PRIMARY KEY,
    sorteo_id          INTEGER NOT NULL REFERENCES sorteos(id),
    vendedor_id        INTEGER NOT NULL REFERENCES usuarios(id),

    comprador_nombre   VARCHAR(150) NOT NULL,
    comprador_telefono VARCHAR(30),               -- opcional

    -- Siempre ordenados ascendentemente por la app antes del INSERT.
    numero_1 SMALLINT NOT NULL CHECK (numero_1 BETWEEN 0 AND 99),
    numero_2 SMALLINT NOT NULL CHECK (numero_2 BETWEEN 0 AND 99),
    numero_3 SMALLINT NOT NULL CHECK (numero_3 BETWEEN 0 AND 99),
    numero_4 SMALLINT NOT NULL CHECK (numero_4 BETWEEN 0 AND 99),

    -- Anular no borra la fila: se marca y se audita quién y cuándo.
    anulada     BOOLEAN NOT NULL DEFAULT false,
    anulada_por INTEGER REFERENCES usuarios(id),
    anulada_at  TIMESTAMPTZ,
    editada_por INTEGER REFERENCES usuarios(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ,

    CONSTRAINT chk_jugadas_orden CHECK (
        numero_1 <= numero_2 AND numero_2 <= numero_3 AND numero_3 <= numero_4
    ),
    CONSTRAINT chk_jugadas_anulacion CHECK (
        (anulada = false AND anulada_por IS NULL     AND anulada_at IS NULL)
     OR (anulada = true  AND anulada_por IS NOT NULL AND anulada_at IS NOT NULL)
    )
);

CREATE INDEX idx_jugadas_sorteo   ON jugadas(sorteo_id);
CREATE INDEX idx_jugadas_vendedor ON jugadas(sorteo_id, vendedor_id);

-- Match de ganadores y buscador por número.
CREATE INDEX idx_jugadas_numeros
    ON jugadas(sorteo_id, numero_1, numero_2, numero_3, numero_4)
    WHERE anulada = false;

-- Buscador por nombre de comprador (dashboard del admin).
CREATE INDEX idx_jugadas_comprador_trgm
    ON jugadas USING gin (comprador_nombre gin_trgm_ops);
