# memories/decisiones-de-diseno.md — Decisiones tomadas

Registro de decisiones de producto tomadas durante el diseño inicial del proyecto.

## Vendedores

- Hay **varios vendedores**, pero todos alimentan el **mismo pozo/sorteo** compartido
  (no son negocios independientes con pozos separados).
- Los vendedores tienen funciones simples: solo cargan **números, nombre del comprador
  y teléfono (opcional)**.
- Los vendedores **no pueden editar ni anular** una jugada ya cargada.

## Compradores

- Los compradores **no tienen cuenta** en el sistema.
- Solo se guarda su **nombre y teléfono de contacto** (teléfono opcional) junto a la jugada.

## Resultado del sorteo

- El número ganador se **carga a mano** por el admin, en base al resultado oficial
  de la quiniela (no se genera dentro del sistema).

## Corrección de errores

- Los vendedores no tienen forma de corregir errores de carga.
- Existe un **panel aparte para el admin**, que es quien puede **editar o anular**
  una jugada cargada por error.

## Pago de premios

- El sistema **no lleva registro** de si el premio fue pagado o no a un ganador.
- Eso se maneja **fuera del sistema** (manualmente, entre vendedor y comprador).

## Visibilidad de datos

- Cada **vendedor ve solo las jugadas que él mismo cargó**.
- El **admin ve todas** las jugadas de todos los vendedores.

## Interfaces (vendedor vs. admin)

- **Pantalla del vendedor: simple.** Formulario de carga (números, nombre del
  comprador, teléfono opcional) + un **listado simple de sus propias jugadas
  cargadas** en el sorteo actual. Nada de estadísticas ni gráficos de este lado.
- **Panel del admin: dashboard completo.** Debe mostrar:
  - Pozo acumulado del sorteo actual.
  - Cantidad de jugadas y recaudación por vendedor.
  - Historial de sorteos anteriores y sus ganadores.
  - Buscador/filtro de jugadas por número o por nombre de comprador.
  - Gráficos de evolución de ventas en el tiempo.

## Comparación de números: orden libre

- **Confirmado (2026-07-30): el orden de los 4 números NO importa.** Una jugada gana
  si tiene los mismos 4 números que el sorteo en cualquier orden.
- Implementación elegida: **normalizar ascendentemente** los números al guardarlos,
  tanto en `jugadas` como en el resultado de `sorteos`. Así el match sigue siendo una
  comparación posicional barata y el índice compuesto sigue sirviendo.
- Esto cierra el pendiente que arrastraba el esquema desde el borrador v1.

## Ingreso al sistema

- **Se entra con un nombre de usuario corto, no con email** (confirmado 2026-07-30).
  Son pocos vendedores y las cuentas las crea el admin a mano: pedir un email
  para entrar era burocracia sin beneficio.
- El **email queda como dato de contacto opcional**. No se eliminó la columna:
  borrar datos no tiene vuelta atrás y no había nada que ganar.
- Formato del usuario: 3 a 30 caracteres, minúsculas, números, punto, guion o
  guion bajo. Sin espacios ni acentos, porque es una credencial que se tipea.
  Para mostrar en pantalla se sigue usando la columna `nombre`.
- Se normaliza a minúsculas al crear la cuenta y al buscarla, así que la
  diferencia de mayúsculas nunca deja a nadie afuera.

## Acceso a datos

- **`pg` (driver oficial) con SQL plano y queries parametrizadas.** Sin ORM.
- Motivo: las queries del dashboard ya estaban escritas a mano en
  `memories/esquema-base-datos.md` y se reusan tal cual; menos capas intermedias y
  más control sobre lo que se ejecuta contra Supabase.

## Números repetidos

- **Una jugada puede tener números repetidos** (ej: `07 07 23 45`, o `55 55 55 55`).
  Confirmado 2026-07-31. Es el comportamiento que ya tenía el backend, así que no
  hizo falta cambiar nada.

## Pendiente

- Nada bloqueante. Lo que queda anotado como deuda está en
  `skills/tech-stack.md` (testing automatizado, peso del bundle).