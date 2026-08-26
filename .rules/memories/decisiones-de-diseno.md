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

## Pendiente

> Acá está el planteo de los pendientes **de producto**. La lista completa —con
> los técnicos, la urgencia y el orden en que conviene encararlos— está en
> [[pendientes]], que es el único índice.

### Anular después del sorteo — A DEFINIR

> Mismo origen que lo de arriba. **Acá no hay decisión tomada: es el planteo, no
> una regla.** La opción 3 sí se hizo (ver abajo); el fondo del asunto sigue
> abierto.

`POST /:id/anular` (`jugadas.routes.js:398`) sigue sin mirar el estado del
sorteo — el `WHERE` es solo `id` y `anulada`. Del lado del front, anular a una
jugada que está cobrando **ya no es un click directo**: desde el 2026-08-26 abre
un cartel que dice a quién le sacás el premio y qué pasa con el reparto. Antes
era un botón suelto en la misma celda donde se pinta el chip **Ganadora**.

**Por qué se dejó abierto.** Anular post-extracto solo puede *quitar* cobradores,
no elegirlos, y hay un caso real a favor: un comprobante que nunca se pagó y se
detecta tarde. Pero inocuo no es — con pozo fijo y reparto entre N, anular a un
ganador sube a los demás de `pozo/N` a `pozo/(N-1)`, y además mueve la
recaudación.

**La pregunta a responder es de negocio, no técnica:** ¿ese caso justifica dejar
la puerta abierta, o se resuelve fuera del sistema como ahora se resuelve una
restauración post-sorteo?

**Opciones anotadas, en orden de costo:**

| # | Qué | Costo | Toca |
|---|---|---|---|
| 2 | Permitir `anular` post-sorteo, pero devolver el impacto (si ganaba, cuántos ganadores quedan y cuánto cobra cada uno) | medio | 1 ruta + `utils/ganadores.js` |
| 3 | ✅ **Hecha (2026-08-26).** Confirmación obligatoria en el front cuando `j.gano`, con el monto en el texto | bajo | 1 pantalla |
| 4 | Que la anulación deje rastro aunque se restaure | alto | migración + constraint o tabla de eventos |

> La numeración arranca en 2 a propósito: la opción 1 era el candado de restaurar
> y ya está hecha.

**Lo que hace la opción 3.** El cartel nombra a quién le sacás el premio, cuánto
cobra, y **qué les pasa a los demás**: con el pozo fijo, sacar a un ganador no
libera plata, la reparte entre los que quedan, que pasan de `pozo/N` a
`pozo/(N-1)`. Eso mueve plata de gente ajena al error que se está corrigiendo y
no se deduce mirando la pantalla. Si era el único ganador, avisa que el sorteo
pasa a vacante. Anular una que no gana sigue saliendo derecho: el cartel en todas
lo volvería un trámite que se aprieta sin leer.

**Esto no reemplaza a la decisión de fondo**, solo saca lo peligroso de la
pantalla. La pregunta de si `anular` tiene que seguir siendo posible después del
sorteo sigue sin responderse, y la opción 2 sigue siendo la que la contestaría
del lado del servidor.

El patrón para 2 ya existe en el repo: `PATCH /api/sorteos/:id/resultado`
(`sorteos.routes.js:299-352`) resuelve el mismo dilema —corregir el extracto
*también* cambia quién cobra— y en vez de bloquear hace visible la consecuencia
con `dejaron_de_ganar`. Anular hoy no tiene ni el bloqueo del PATCH de jugadas ni
el informe del PATCH de resultado.

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
