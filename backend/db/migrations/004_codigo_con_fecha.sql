-- 004_codigo_con_fecha.sql
--
-- El código de comprobante pasa de `XXXX-XXXX` a `AAMMDD-XXXXXX`: los primeros
-- seis dígitos son la fecha en que se cargó la jugada.
--
--   260815-K7M3XQ
--   └──┬──┘ └──┬──┘
--      │       └── aleatorio, 6 caracteres
--      └────────── 15 de agosto de 2026
--
-- Se regeneran TODOS los códigos, incluidos los ya emitidos. Es seguro ahora
-- porque todavía no se entregó ningún comprobante real; una vez que el sistema
-- esté en uso, este tipo de migración deja de ser aceptable: invalidaría los
-- papeles que la gente tiene en la mano.
--
-- Cada código se regenera con el `created_at` de su propia jugada, no con la
-- fecha de hoy, para que la fecha del comprobante sea la de la venta.

-- El DEFAULT de la columna usa la función vieja, así que hay que soltarlo antes
-- de poder borrarla. De paso ya no hace falta: a partir de ahora el código lo
-- pone un trigger, porque depende de otra columna de la propia fila.
ALTER TABLE jugadas ALTER COLUMN codigo DROP DEFAULT;

-- La firma cambia (ahora recibe la fecha), así que hay que soltar la anterior:
-- CREATE OR REPLACE crearía una sobrecarga en vez de reemplazarla.
DROP FUNCTION IF EXISTS generar_codigo_jugada();

CREATE OR REPLACE FUNCTION generar_codigo_jugada(fecha TIMESTAMPTZ DEFAULT now())
RETURNS TEXT AS $$
DECLARE
    -- Sin caracteres ambiguos al dictar: sin 0/O, sin 1/I/L, sin U.
    -- (La parte de la fecha sí lleva dígitos: ahí el contexto desambigua.)
    alfabeto CONSTANT TEXT := '23456789ABCDEFGHJKMNPQRSTVWXYZ';
    bruto    TEXT := '';
BEGIN
    FOR i IN 1..6 LOOP
        bruto := bruto || substr(alfabeto, floor(random() * length(alfabeto) + 1)::int, 1);
    END LOOP;

    RETURN to_char(fecha, 'YYMMDD') || '-' || bruto;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- El UNIQUE se saca mientras se regenera, para poder resolver las colisiones
-- que aparezcan; se vuelve a poner al final.
ALTER TABLE jugadas DROP CONSTRAINT jugadas_codigo_key;
ALTER TABLE jugadas ALTER COLUMN codigo TYPE VARCHAR(13);

UPDATE jugadas SET codigo = generar_codigo_jugada(created_at);

-- La parte aleatoria puede repetirse. Se regeneran los duplicados hasta que no
-- queden: preferimos un par de vueltas acá a una migración que falle al azar.
DO $$
BEGIN
    LOOP
        UPDATE jugadas
        SET codigo = generar_codigo_jugada(created_at)
        WHERE id IN (
            SELECT id FROM (
                SELECT id, ROW_NUMBER() OVER (PARTITION BY codigo ORDER BY id) AS repetido
                FROM jugadas
            ) duplicadas
            WHERE repetido > 1
        );
        EXIT WHEN NOT FOUND;
    END LOOP;
END $$;

ALTER TABLE jugadas ADD CONSTRAINT jugadas_codigo_key UNIQUE (codigo);

-- Ya no alcanza un DEFAULT: el código depende de otra columna de la propia fila
-- (`created_at`), y un DEFAULT no puede leerla. Lo pone un trigger, que corre
-- después de que se aplicaron los defaults, así que ya ve la fecha definitiva.
CREATE OR REPLACE FUNCTION completar_codigo_jugada() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.codigo IS NULL THEN
        NEW.codigo := generar_codigo_jugada(NEW.created_at);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_completar_codigo_jugada
    BEFORE INSERT ON jugadas
    FOR EACH ROW
    EXECUTE FUNCTION completar_codigo_jugada();
