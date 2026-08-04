-- Se elimina el email de las cuentas.
--
-- Esto reemplaza a lo decidido en la 003, donde el email había quedado como
-- dato de contacto opcional. En la práctica nadie lo cargó ni lo miró: las
-- cuentas las crea el admin en persona y lo que hace falta para dar de alta a
-- un vendedor es nombre, usuario y contraseña. Un campo que siempre queda vacío
-- solo estorba en el formulario.
--
-- Se pierden los emails guardados. No hay forma de recuperarlos desde la app,
-- pero tampoco se usaban para nada: nunca fueron credencial de ingreso (eso es
-- `usuario` desde la 003) ni se le mandó un mail a nadie.

ALTER TABLE usuarios DROP COLUMN email;
