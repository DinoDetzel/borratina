-- Cuándo se cambió por última vez la contraseña de cada cuenta.
--
-- Sirve para que restablecer una contraseña sirva de algo: los tokens que se
-- firmaron antes del cambio dejan de valer (requireAuth compara el `iat` del
-- token contra esta fecha). Sin esto, cambiarle la clave a alguien no lo echa
-- de la sesión que ya tiene abierta, que es justo lo que se quiere cuando la
-- clave se filtró.
--
-- El DEFAULT now() vale también para las cuentas que ya existen: sus tokens
-- actuales se invalidan una sola vez, al correr esta migración.

ALTER TABLE usuarios
    ADD COLUMN password_actualizada_at TIMESTAMPTZ NOT NULL DEFAULT now();
