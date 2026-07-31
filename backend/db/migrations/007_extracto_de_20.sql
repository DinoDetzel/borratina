-- 007_extracto_de_20.sql
--
-- Cambio de fondo en cómo se gana.
--
-- Antes:  el sorteo tenía 4 números y la jugada ganaba si coincidían los 4.
-- Ahora:  el sorteo carga el **extracto de quiniela completo, 20 números**, y la
--         jugada gana si sus 4 números están **dentro** de esos 20.
--
-- En el extracto un número puede salir más de una vez, y eso importa: si la
-- jugada repite un número, el extracto tiene que repetirlo también. Es decir, la
-- jugada tiene que estar contenida en el extracto **como multiconjunto**, no como
-- conjunto:
--
--   extracto 07 14 23 45 …   jugada 07 07 23 45  → NO gana (un solo 07)
--   extracto 07 07 23 45 …   jugada 07 07 23 45  → gana
--
-- El resultado pasa a un array en vez de columnas sueltas: veinte columnas
-- numero_1..numero_20 serían ilegibles y no aportan nada, porque el orden del
-- extracto no interviene en el match.

ALTER TABLE sorteos ADD COLUMN numeros SMALLINT[];

-- Los sorteos que ya estaban finalizados guardaban un resultado de 4 números, que
-- en el modelo nuevo no significa nada: no se puede saber cuáles serían los otros
-- 16 sin inventarlos. Vuelven a 'cerrado' y sin resultado, listos para que se les
-- cargue el extracto real. Las jugadas no se tocan.
UPDATE sorteos
SET estado = 'cerrado',
    fecha_resultado = NULL,
    numero_1 = NULL, numero_2 = NULL, numero_3 = NULL, numero_4 = NULL
WHERE estado = 'finalizado';

-- Las columnas viejas quedan sin uso: el resultado ahora vive en `numeros`.
ALTER TABLE sorteos DROP CONSTRAINT chk_sorteos_orden;
ALTER TABLE sorteos DROP CONSTRAINT chk_sorteos_resultado_completo;
ALTER TABLE sorteos DROP CONSTRAINT chk_sorteos_finalizado;

ALTER TABLE sorteos DROP COLUMN numero_1;
ALTER TABLE sorteos DROP COLUMN numero_2;
ALTER TABLE sorteos DROP COLUMN numero_3;
ALTER TABLE sorteos DROP COLUMN numero_4;

-- El extracto son exactamente 20 números del 00 al 99. Se guarda tal como salió:
-- a diferencia de las jugadas, acá no se normaliza el orden, porque el extracto
-- publicado tiene un orden propio y conviene poder mostrarlo como se leyó.
ALTER TABLE sorteos ADD CONSTRAINT chk_sorteos_extracto CHECK (
    numeros IS NULL
    OR (
        array_length(numeros, 1) = 20
        AND 0 <= ALL (numeros)
        AND 99 >= ALL (numeros)
    )
);

-- No se puede finalizar un sorteo sin haber cargado el extracto.
ALTER TABLE sorteos ADD CONSTRAINT chk_sorteos_finalizado CHECK (
    estado <> 'finalizado' OR numeros IS NOT NULL
);
