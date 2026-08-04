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

## Evolución de ventas

- El gráfico es siempre **diario**. La **tabla** que está detrás del botón "Ver
  tabla" se **agrupa por semana del mes** (1–7, 8–14, 15–21, 22–28 y 29 en
  adelante) desde los 8 días con ventas (2026-08-04): día por día eran treinta
  y pico de renglones en el teléfono.
- Se corta por número de día y no cada 7 días desde la primera venta, para que
  las filas caigan siempre en las mismas fechas y dos sorteos se puedan comparar
  renglón contra renglón.

## Vendedores en el panel

- La tarjeta **"Por vendedor" del panel es un podio: muestra los 5 que más
  cargaron** y nada más (confirmado 2026-08-04). Con más filas le sacaba altura
  al gráfico que tiene al lado.
- El enlace **"Ver todos"** lleva a `/admin/vendedores`, que lista **todas las
  cuentas del sistema**, incluidas las inactivas, las del admin y las que **no
  cargaron ninguna jugada** en ese sorteo: la pregunta que contesta esa pantalla
  es quién *no* está vendiendo, y ahí un ausente es el dato.
- Muestra del sorteo elegido las jugadas, las anuladas y la recaudación, y de
  todos los sorteos el total histórico y la última carga, para distinguir al que
  nunca cargó nada del que este mes no cargó.
- No va en la barra de navegación: se llega desde el panel, como al detalle de
  un sorteo.

## Dónde se buscan y se corrigen las jugadas

- **El buscador vive dentro del detalle del sorteo** (`/admin/sorteos/:id`), y ahí
  mismo se anula, se restaura, se corrige y se reenvía el comprobante
  (confirmado 2026-08-03).
- Antes había además una pantalla `/admin/jugadas` con la lista de todas las
  jugadas y un selector de sorteo. Decía lo mismo que el detalle: se eliminó, y
  el sorteo pasó a elegirse entrando al sorteo, no desde un desplegable.

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
- **El email se eliminó** (2026-07-31), y esto reemplaza a lo que decía antes esta
  misma sección: la 003 lo había dejado como dato de contacto opcional, pero
  quedaba siempre vacío. Un vendedor se da de alta con **nombre, usuario y
  contraseña**, nada más. Migración 009.
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