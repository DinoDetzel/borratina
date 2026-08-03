-- 012_fecha_del_codigo_en_hora_argentina.sql
--
-- Los primeros seis dígitos del código son la fecha de la venta, y salían
-- corridos: `to_char()` sobre un TIMESTAMPTZ usa la zona de la sesión, y el
-- Postgres corre en UTC. Una jugada cargada un domingo a las 21:55 se llevaba
-- impreso el lunes.
--
-- Tres horas por día, todas las noches, que es cuando más se vende.
--
-- La zona va escrita en la función y no se deja librada a la configuración de
-- la sesión: el código sale impreso en un papel que la gente guarda para
-- reclamar un premio, y no puede depender de cómo arrancó el servidor. La
-- configuración igual se fija (ver src/db.js), pero para lo demás.
--
-- Los códigos ya emitidos NO se tocan. La migración 004 los regeneró todos
-- porque el sistema todavía no estaba en uso; ahora sí lo está, y hay
-- comprobantes en manos de compradores. Un comprobante con la fecha corrida
-- sigue siendo válido: se busca por el código entero, que no cambió, y la fecha
-- real de la venta está en `created_at`. Cambiarlos ahora rompería el papel.

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

    RETURN to_char(fecha AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYMMDD')
           || '-' || bruto;
END;
$$ LANGUAGE plpgsql VOLATILE;
