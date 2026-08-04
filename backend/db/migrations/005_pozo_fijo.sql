-- 005_pozo_fijo.sql
--
-- Cambio de regla de negocio: el pozo deja de calcularse y pasa a ser **fijo**.
--
-- Antes:  pozo = jugadas no anuladas × precio_jugada
-- Ahora:  el admin lo define al abrir el sorteo (ej: $1.500.000 para agosto)
--
-- El premio se anuncia de entrada y no depende de cuánto se venda. Por eso la
-- columna se renombra: `pozo_total` sonaba a total calculado y ahora es un dato
-- de entrada, no un resultado.
--
-- `precio_jugada` NO desaparece: sigue siendo lo que paga cada comprador. Lo que
-- cambia es que ya no determina el premio, así que pozo y recaudación pasan a ser
-- dos números distintos —y su diferencia es lo que gana o pierde el organizador.

ALTER TABLE sorteos RENAME COLUMN pozo_total TO pozo;

-- Los sorteos ya creados conservan lo que tenían. Los que estaban en NULL (los
-- que todavía no se habían finalizado) se rellenan con lo que el cálculo viejo
-- habría dado, que es el número que se venía mostrando en pantalla.
--
-- Un sorteo sin jugadas daría 0 y no pasaría el CHECK de abajo, así que en ese
-- caso se usa el precio de una jugada como piso. Es un valor de relleno sin
-- significado: son sorteos que todavía no vendieron nada y el admin va a querer
-- corregirlo igual.
UPDATE sorteos s
SET pozo = GREATEST(
    (SELECT COUNT(*) FROM jugadas j WHERE j.sorteo_id = s.id AND j.anulada = false)
        * s.precio_jugada,
    s.precio_jugada
)
WHERE s.pozo IS NULL;

ALTER TABLE sorteos ALTER COLUMN pozo SET NOT NULL;
ALTER TABLE sorteos ADD CONSTRAINT chk_sorteos_pozo CHECK (pozo > 0);
