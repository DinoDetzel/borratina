-- 003_usuario_login.sql
--
-- La credencial de ingreso pasa a ser un nombre de usuario corto en vez del
-- email. Son pocos vendedores y las cuentas las crea el admin a mano, así que
-- pedir un email para entrar era burocracia sin beneficio.
--
-- El email NO se elimina: queda como dato de contacto opcional. Borrar una
-- columna con datos no tiene vuelta atrás, y no hay nada que ganar con hacerlo.

ALTER TABLE usuarios ADD COLUMN usuario VARCHAR(30);

-- Backfill: se toma la parte del email anterior al @. Si dos emails distintos
-- comparten esa parte (ana@uno.com y ana@dos.com), se desempata con el id para
-- no violar el UNIQUE que se agrega abajo.
UPDATE usuarios
SET usuario = calculado.candidato
FROM (
    SELECT id,
           CASE WHEN repetidos = 1 THEN base ELSE base || id::text END AS candidato
    FROM (
        SELECT id,
               lower(split_part(email, '@', 1)) AS base,
               COUNT(*) OVER (PARTITION BY lower(split_part(email, '@', 1))) AS repetidos
        FROM usuarios
    ) bases
) calculado
WHERE usuarios.id = calculado.id;

ALTER TABLE usuarios ALTER COLUMN usuario SET NOT NULL;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_usuario_key UNIQUE (usuario);

-- Se guarda siempre en minúsculas (lo normaliza la app). Sin espacios ni
-- acentos: es una credencial que se tipea, no un nombre para mostrar — para eso
-- ya está la columna `nombre`.
ALTER TABLE usuarios ADD CONSTRAINT chk_usuarios_usuario
    CHECK (usuario ~ '^[a-z0-9._-]{3,30}$');

-- El email deja de ser obligatorio. Sigue siendo único cuando está presente:
-- en Postgres, los NULL no colisionan entre sí en un UNIQUE.
ALTER TABLE usuarios ALTER COLUMN email DROP NOT NULL;
