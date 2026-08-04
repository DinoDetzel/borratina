-- Deja rastro de los números que tenía una jugada antes de que la corrigieran.
--
-- Hasta ahora, corregir una jugada guardaba quién la tocó (`editada_por`) pero
-- no qué decía antes: si alguien discutía que sus números eran otros, no había
-- con qué contestarle. Es el mismo criterio que `sorteos.numeros_anteriores`
-- (migración 010): una corrección no puede pisar el dato en silencio.
--
-- Va junto con la regla que impide cambiar los números de una jugada cuando el
-- sorteo ya se sorteó. Las dos cosas apuntan a lo mismo: que después del
-- extracto nadie pueda mover quién cobra.

ALTER TABLE jugadas ADD COLUMN numeros_anteriores SMALLINT[];

COMMENT ON COLUMN jugadas.numeros_anteriores IS
    'Los 4 números que tenía la jugada antes de la última corrección. NULL si nunca se corrigió.';
