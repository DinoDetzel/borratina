-- 002_codigo_comprobante.sql
--
-- Cada jugada pasa a tener un código de comprobante único, que es lo que se le
-- entrega al comprador. El `id` serial no sirve para eso: es correlativo, así
-- que cualquiera puede adivinar los comprobantes ajenos probando números.
--
-- El código lo genera la base por DEFAULT y no la aplicación: así es imposible
-- que quede una jugada sin comprobante, y el formato vive en un solo lugar.

-- Alfabeto sin caracteres ambiguos al dictar o escribir a mano:
-- se excluyen 0/O, 1/I/L y U (se confunde con V).
CREATE OR REPLACE FUNCTION generar_codigo_jugada() RETURNS TEXT AS $$
DECLARE
    alfabeto CONSTANT TEXT := '23456789ABCDEFGHJKMNPQRSTVWXYZ';
    bruto    TEXT := '';
BEGIN
    FOR i IN 1..8 LOOP
        bruto := bruto || substr(alfabeto, floor(random() * length(alfabeto) + 1)::int, 1);
    END LOOP;
    -- Se parte en dos grupos de 4: más fácil de leer y de dictar por teléfono.
    RETURN substr(bruto, 1, 4) || '-' || substr(bruto, 5, 4);
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Al ser un DEFAULT volátil, Postgres evalúa la función fila por fila y las
-- jugadas que ya existían quedan con un código distinto cada una.
ALTER TABLE jugadas
    ADD COLUMN codigo VARCHAR(9) NOT NULL DEFAULT generar_codigo_jugada();

ALTER TABLE jugadas
    ADD CONSTRAINT jugadas_codigo_key UNIQUE (codigo);
