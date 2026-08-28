-- Deja rastro de las anulaciones aunque después se restauren.
--
-- Hasta ahora, restaurar una jugada nulificaba `anulada_por` y `anulada_at`, así
-- que no quedaba constancia de que hubiera estado anulada ni de quién lo hizo.
-- Y no era un descuido de la ruta: el `CHECK chk_jugadas_anulacion` **obliga** a
-- nulificarlos cuando `anulada = false`. Con varios admins, eso deja los
-- controles de anulación sin registro: se podía anular y restaurar sin huella.
--
-- Alcanza solo a los sorteos abiertos, porque una jugada de un sorteo ya
-- sorteado no se puede restaurar (esa es otra regla) y ahí las columnas quedan
-- para siempre. Igual el agujero era real: anular y restaurar antes del extracto
-- es lo habitual, y es cuando se corrigen los errores de carga.
--
-- **Por qué una tabla aparte y no relajar el CHECK.** Conservar `anulada_por` con
-- `anulada = false` haría ambigua esa columna: dejaría de significar "quién la
-- tiene anulada" para pasar a significar "quién la anuló alguna vez", y hay
-- código leyéndola con el primer sentido. El CHECK, además, es lo que garantiza
-- que el estado actual sea coherente, y vale la pena conservarlo tal cual.
--
-- Así quedan separadas dos cosas distintas: `jugadas` sigue diciendo **cómo está
-- la jugada hoy**, y esta tabla **qué le fue pasando**. Tampoco pierde a quien
-- restauró, que antes se escribía en `editada_por` pisando a quien hubiera
-- corregido el nombre del comprador.

CREATE TABLE jugadas_eventos (
    id SERIAL PRIMARY KEY,
    jugada_id INTEGER NOT NULL REFERENCES jugadas(id),
    tipo VARCHAR(20) NOT NULL,
    -- Quién lo hizo. Sin ON DELETE: una cuenta que dejó eventos no se puede
    -- borrar, que es la misma regla que ya rige para las jugadas.
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_jugadas_eventos_tipo CHECK (tipo IN ('anulada', 'restaurada'))
);

-- Se consulta siempre por jugada y en orden cronológico.
CREATE INDEX idx_jugadas_eventos_jugada ON jugadas_eventos (jugada_id, created_at);

COMMENT ON TABLE jugadas_eventos IS
    'Historial de anulaciones y restauraciones. jugadas dice cómo está hoy; esto, qué le fue pasando.';

-- Las que están anuladas ahora sí tienen su dato en `jugadas`: se traslada, para
-- no arrancar el historial fingiendo que nunca pasó nada. Lo que no se puede
-- recuperar es lo anterior a esta migración que ya se restauró: eso se perdió y
-- no hay de dónde sacarlo.
INSERT INTO jugadas_eventos (jugada_id, tipo, usuario_id, created_at)
SELECT id, 'anulada', anulada_por, anulada_at
FROM jugadas
WHERE anulada = true AND anulada_por IS NOT NULL AND anulada_at IS NOT NULL;
