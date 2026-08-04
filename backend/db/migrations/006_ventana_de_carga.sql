-- 006_ventana_de_carga.sql
--
-- Cada sorteo pasa a tener una ventana de carga explícita: desde cuándo y hasta
-- cuándo se pueden cargar jugadas. El admin la define al abrirlo.
--
-- El sistema la hace cumplir: fuera de la ventana el INSERT se rechaza, aunque el
-- sorteo siga en estado 'abierto'. El admin puede además cerrar antes de tiempo a
-- mano, así que hay dos fechas de cierre que no son lo mismo:
--
--   finaliza_at        → cuándo estaba previsto que cerrara
--   fecha_cierre_carga → cuándo lo cerró el admin efectivamente (puede ser antes,
--                        o nunca si dejó que venciera solo)

ALTER TABLE sorteos ADD COLUMN inicia_at   TIMESTAMPTZ;
ALTER TABLE sorteos ADD COLUMN finaliza_at TIMESTAMPTZ;

-- Los sorteos que ya existen: arrancaron cuando se crearon y, si nadie los cerró,
-- se les da como fin el último instante de su propio mes, que es lo que el
-- período ya implicaba.
UPDATE sorteos
SET inicia_at = created_at,
    finaliza_at = COALESCE(
        fecha_cierre_carga,
        ((periodo || '-01')::date + INTERVAL '1 month' - INTERVAL '1 second')
    )
WHERE inicia_at IS NULL;

-- Si algún sorteo se cerró el mismo día que se creó, el COALESCE de arriba pudo
-- dejar el fin antes o igual que el inicio. Se corre una hora para que pase el
-- CHECK sin inventar una fecha lejana.
UPDATE sorteos
SET finaliza_at = inicia_at + INTERVAL '1 hour'
WHERE finaliza_at <= inicia_at;

ALTER TABLE sorteos ALTER COLUMN inicia_at   SET NOT NULL;
ALTER TABLE sorteos ALTER COLUMN finaliza_at SET NOT NULL;

ALTER TABLE sorteos ADD CONSTRAINT chk_sorteos_ventana
    CHECK (finaliza_at > inicia_at);
