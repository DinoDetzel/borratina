-- Permite corregir el extracto de un sorteo ya finalizado, dejando registro.
--
-- Son 20 números que alguien tipea a mano leyendo la pizarra de la quiniela.
-- Un dedazo en uno solo cambia quién cobra, y hasta ahora no había forma de
-- arreglarlo: el sorteo quedaba finalizado con el número equivocado.
--
-- Corregir no es lo mismo que cargar: se guarda quién lo hizo, cuándo, y qué
-- extracto había antes. Es la misma idea que `anulada_por` / `editada_por` en
-- jugadas: acá nada se pisa en silencio.

ALTER TABLE sorteos
    ADD COLUMN resultado_corregido_at  TIMESTAMPTZ,
    ADD COLUMN resultado_corregido_por INTEGER REFERENCES usuarios(id),
    ADD COLUMN numeros_anteriores      SMALLINT[];

COMMENT ON COLUMN sorteos.numeros_anteriores IS
    'El extracto que había antes de la última corrección. NULL si nunca se corrigió.';
