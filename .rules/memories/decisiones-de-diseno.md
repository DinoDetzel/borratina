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

## El sistema piensa en la hora del club, no en la del servidor

- **Confirmado 2026-08-04.** Todo lo que sea "qué día es" se resuelve en
  `America/Argentina/Buenos_Aires`, aunque el Postgres y el Render corran en UTC.
  Con el servidor en UTC, una jugada cargada a las 21:30 caía al día siguiente:
  salía impreso en el código del comprobante y movía de día las ventas del
  gráfico. Tres horas por noche, que es cuando más se vende.
- La zona es configurable por `TZ_CLUB`, con la de Buenos Aires por defecto. Se
  aplica en dos lugares y a propósito: el pool la fija para toda la sesión
  (`src/db.js`) y la función que genera el código la lleva **escrita adentro**
  (migración 012), porque ese código sale impreso en un papel que la gente guarda
  para reclamar un premio y no puede depender de cómo arrancó el servidor.
- **Los comprobantes ya emitidos con la fecha corrida no se tocaron.** Siguen
  siendo válidos: se buscan por el código entero, que no cambió. Detalle en
  [[esquema-base-datos]].

## Restaurar una jugada después del sorteo ✅ RESUELTO

> Detectado en revisión de código (2026-08-04) y cerrado el mismo día.

`PATCH /api/jugadas/:id` ya bloqueaba el cambio de números una vez finalizado el
sorteo, con un argumento explícito: con el extracto a la vista, editar una jugada
es elegir quién gana. **Restaurar caía en lo mismo y no tenía candado.** Y no
hace falta inventar una jugada para aprovecharlo: alcanza con anular varias
mientras el sorteo está abierto —legítimo y habitual— y restaurar después la que
salió. Equivale a elegir al ganador entre las cargadas.

- `POST /:id/restaurar` lleva ahora la misma condición que el PATCH, y **dentro
  del `UPDATE`**, no como chequeo previo: si el admin carga el extracto justo
  entre la lectura y la escritura, no se cuela igual.
- `errorDeRestauracion()` distingue los tres motivos, como `errorDeCarga()`. Si
  la jugada además no estaba anulada, gana ese mensaje: es el útil.
- El botón **Restaurar** sigue apareciendo en sorteos finalizados, porque el
  criterio del sistema es explicar por qué no se puede en vez de esconder el
  control. Al principio eso se cumplía mal: el motivo llegaba como error del
  backend *después* de apretarlo, o sea que la forma de enterarte era chocarte.
  Desde el 2026-08-26 el botón va atenuado y al tocarlo abre un cartel con el
  motivo, sin viaje al servidor.
- Va como botón normal y **no deshabilitado**, a propósito: un `button` con
  `disabled` no recibe eventos de mouse, así que el navegador nunca muestra su
  `title`, y en el teléfono directamente no hay hover con el que llegar al
  motivo. Por lo mismo el aviso es un cartel y no un tooltip.

Regla de negocio actualizada en [[reglas-de-negocio]] → "Anulación y corrección".

## Anular después del sorteo ✅ SIGUE PERMITIDO

> **Confirmado 2026-08-26.** Se evaluó restringirlo, como se restringió
> restaurar, y se decidió que **no**: anular sigue siendo posible con el sorteo
> finalizado. No hubo cambio de código; lo que cambió es que ahora está decidido.

`POST /:id/anular` (`jugadas.routes.js:398`) no mira el estado del sorteo — el
`WHERE` es solo `id` y `anulada`— y así se queda. Del lado del front, anular una
jugada que está cobrando abre un cartel con a quién le sacás el premio y qué pasa
con el reparto.

**Por qué se permite.** Anular post-extracto solo puede *quitar* cobradores, no
elegirlos, que es la diferencia con restaurar: restaurar podía fabricar un
ganador, anular no. Y hay un caso real detrás — un comprobante que nunca se pagó
y se detecta tarde. Cerrarlo obligaría a resolver a mano algo que el sistema
puede registrar.

**Inocuo no es**, y por eso se decidió con lo otro ya hecho: con pozo fijo y
reparto entre N, anular a un ganador sube a los demás de `pozo/N` a `pozo/(N-1)`
y mueve la recaudación. Lo que volvía eso peligroso era que pasara de un click y
sin enterarse; con el cartel de por medio, la consecuencia se ve antes de
confirmar.

**El rastro, acá, es permanente.** Es el argumento que terminó de cerrar la
discusión: como restaurar está bloqueado una vez sorteado, `anulada_por` y
`anulada_at` de una anulación post-sorteo **no se pueden borrar nunca**. El
agujero del rastro (ver abajo) afecta a las anulaciones de sorteos abiertos, no a
estas. La operación más delicada es, justamente, la única que queda auditada para
siempre.

**Opciones anotadas, en orden de costo:**

| # | Qué | Costo | Toca |
|---|---|---|---|
| 2 | ⛔ **Descartada (2026-08-26).** Permitir `anular` post-sorteo, pero devolver el impacto (si ganaba, cuántos ganadores quedan y cuánto cobra cada uno) | medio | 1 ruta + `utils/ganadores.js` |
| 3 | ✅ **Hecha (2026-08-26).** Confirmación obligatoria en el front cuando `j.gano`, con el monto en el texto | bajo | 1 pantalla |
| 4 | Que la anulación deje rastro aunque se restaure | alto | migración + constraint o tabla de eventos |

> La numeración arranca en 2 a propósito: la opción 1 era el candado de restaurar
> y ya está hecha.

La 2 se descartó porque la 3 ya cubre lo que resolvía. El impacto se muestra
**antes** de anular, que es cuando sirve para no hacerlo; devolverlo después, con
la anulación consumada, informa algo que ya no se puede evitar. Si alguna vez se
necesita el número exacto del servidor —por concurrencia, o para registrarlo—,
el planteo queda acá.

**Lo que hace la opción 3.** El cartel nombra a quién le sacás el premio, cuánto
cobra, y **qué les pasa a los demás**: con el pozo fijo, sacar a un ganador no
libera plata, la reparte entre los que quedan, que pasan de `pozo/N` a
`pozo/(N-1)`. Eso mueve plata de gente ajena al error que se está corrigiendo y
no se deduce mirando la pantalla. Si era el único ganador, avisa que el sorteo
pasa a vacante.

**Anular se confirma siempre, no solo cuando gana** (2026-08-26, pedido del
usuario). Al principio la anulación común salía derecho, con el argumento de que
el cartel en todas se termina apretando sin leer. Ese argumento no se sostiene
cuando la acción no se puede deshacer: una vez sorteado, restaurar está
bloqueado, así que anular por error una jugada cualquiera tampoco tiene vuelta
atrás. El riesgo de que se vuelva un trámite se ataca con el texto —qué jugada,
de quién, y si se puede restaurar o no— y no sacando el freno.

El criterio no es original de acá: `PATCH /api/sorteos/:id/resultado`
(`sorteos.routes.js:299-352`) resuelve el mismo dilema —corregir el extracto
*también* cambia quién cobra— y en vez de bloquear hace visible la consecuencia
con `dejaron_de_ganar`. Anular queda igual: no se prohíbe, se muestra lo que
provoca.

## Pendiente

> Acá está el planteo del único pendiente **de producto** que queda abierto. La
> lista completa —con los técnicos, la urgencia y el orden en que conviene
> encararlos— está en [[pendientes]], que es el único índice.

### El rastro de la anulación se borra — A DEFINIR

Es el punto 4 de la tabla y sobrevive al arreglo de restaurar, aunque con menos
gravedad: el camino de "anulo con el sorteo abierto y restauro después" quedó
cerrado, pero una restauración *antes* del sorteo sigue sin dejar registro.

`restaurar` nulifica `anulada_por` y `anulada_at` (`jugadas.routes.js:460-461`),
así que después no queda constancia de que la jugada estuvo anulada ni de quién
la anuló. `editada_por` además pisa a quien hubiera corregido el nombre antes. No
hay tabla de historial. Y no es un descuido de la ruta: el `CHECK
chk_jugadas_anulacion` (`001_init.sql:91-94`) **obliga** a nulificarlos cuando
`anulada = false`. Cualquier arreglo toca el esquema, por eso va aparte.

Mientras esto no exista, los controles de anular son controles sin registro.
