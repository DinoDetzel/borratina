# memories/reglas-de-negocio.md — Reglas del juego (Borratina)

## Qué es

La borratina es un juego de azar tradicional vinculado a la quiniela: lotería poceada,
con modalidad de extractos de quiniela y premios por aciertos numéricos.

## Funcionamiento

- Cada participante elige **4 números de dos cifras** (00-99).
- Varias personas pueden jugar la misma combinación.
- El sorteo se realiza **una vez por mes**.
- Al sortearse, el admin carga el **extracto oficial de la quiniela: 20 números**.
- **Gana la jugada cuyos 4 números están dentro de esos 20.**
- Si una o más personas ganan, el **pozo se reparte en partes iguales** entre todos.
- Si nadie acierta, el sorteo **queda vacante**.

## Cómo se gana: 4 dentro de 20 ✅ CONFIRMADO

> Confirmado por el usuario (2026-07-31). Esta sección reemplaza dos versiones
> anteriores equivocadas: la primera suponía comparación posicional contra 4
> números, la segunda comparación de conjuntos también contra 4. **El sorteo no
> tiene 4 números: tiene 20.**

```
EXTRACTO (20 números)
  07 14 23 31 45 52 60 66 71 88
  02 19 27 33 40 55 63 77 84 91

jugada  07 23 45 88   → GANA   (los 4 están)
jugada  07 23 45 99   → pierde (el 99 no salió)
```

- El **orden no importa**, ni el de la jugada ni el del extracto: lo que cuenta es
  qué números salieron.
- **No hay premios parciales**: acertar 3 de 4 no paga nada. Es todo o nada.

### Los repetidos cuentan

En el extracto **un número puede salir más de una vez**, y eso importa: si la
jugada repite un número, el extracto tiene que repetirlo también. La jugada tiene
que estar contenida en el extracto **como multiconjunto**, no como conjunto.

```
extracto con un solo 07 …  jugada  07 07 23 45  → pierde
extracto con dos 07    …  jugada  07 07 23 45  → GANA
```

Jugar un número repetido es entonces una apuesta más difícil que jugar 4 distintos.

### Cómo está implementado

- El extracto se guarda como un array de 20 en `sorteos.numeros`, **sin normalizar
  el orden**: el extracto publicado tiene un orden propio y conviene poder
  mostrarlo como se leyó.
- Los 4 números de la jugada **sí** se normalizan ascendentes, que es lo que hace
  utilizable el índice para el buscador por combinación exacta.
- La regla vive en `backend/src/utils/ganadores.js`, en dos formas que tienen que
  dar siempre lo mismo: `condicionGanadora()` (SQL, para las queries) y
  `esGanadora()` (JS, para cuando los datos ya están en memoria).

## El sorteo

- Hay **un sorteo por mes**, identificado por su período (`AAAA-MM`).
- El sorteo es **único y compartido**: todos los vendedores alimentan el mismo pozo.
- Existe **como máximo un sorteo con la carga abierta** en un momento dado.
- Cada sorteo tiene un **precio por jugada** fijo, definido al abrirlo.

### Ciclo de vida

| Estado | Qué significa | Quién lo dispara |
|---|---|---|
| `abierto` | Los vendedores pueden cargar jugadas | Admin abre el sorteo del mes |
| `cerrado` | Ya no se cargan jugadas, todavía no salió el resultado | Admin cierra la carga |
| `finalizado` | Se cargó el número ganador y se calcularon los ganadores | Admin carga el resultado |

- Las transiciones son **solo hacia adelante**: `abierto` → `cerrado` → `finalizado`.
- Una jugada solo puede cargarse mientras el sorteo está `abierto` **y además la
  ventana de carga está vigente** (ver abajo).

### Ventana de carga

- Al abrir el sorteo, el admin define **desde cuándo y hasta cuándo** se pueden
  cargar jugadas (día y hora).
- El sistema **las hace cumplir**: fuera de esa ventana la carga se rechaza,
  aunque el sorteo siga en estado `abierto`.
- El admin puede además **cerrar antes de tiempo** a mano. Por eso hay dos fechas
  de cierre que no son lo mismo:
  - `finaliza_at` → cuándo estaba previsto que cerrara
  - `fecha_cierre_carga` → cuándo lo cerró el admin efectivamente (puede no existir,
    si dejó que venciera solo)
- Las fechas se pueden corregir mientras el sorteo esté abierto, igual que el pozo.
- La pantalla del vendedor avisa cuánto falta para el cierre y deshabilita el
  formulario cuando la carga no está habilitada: enterarse al apretar "Cargar",
  con los datos del comprador ya tipeados, es la peor forma de descubrirlo.

## El pozo

- El pozo es **fijo**: lo define el admin al abrir el sorteo (ej: $1.500.000 para
  agosto) y **no depende de cuánto se venda**.
- Es el premio que se anuncia de entrada, y es el gancho de venta: es lo que el
  vendedor le dice al comprador.
- Se puede corregir **mientras la carga esté abierta**. Una vez cerrada, no: el
  premio ya se anunció con las jugadas hechas.

> Antes el pozo se calculaba como `jugadas no anuladas × precio_jugada` y se
> congelaba al finalizar. Cambió en la migración 005.

## Pozo y recaudación son cosas distintas

Al ser el pozo fijo, dejó de coincidir con lo recaudado:

```
recaudación = jugadas NO anuladas × precio_jugada
resultado   = recaudación − pozo
```

- El **resultado** es lo que gana o pierde el organizador con ese sorteo. Si se
  vende poco, se paga el premio igual y se pierde plata.
- El punto de equilibrio es `pozo / precio_jugada` jugadas.
- Las jugadas **anuladas no cuentan** para la recaudación ni pueden ganar, pero
  ya no afectan el premio: el pozo es el mismo se venda lo que se venda.

## El resultado

- El resultado es el **extracto oficial de la quiniela: 20 números del 00 al 99**,
  donde un mismo número puede aparecer más de una vez.
- Lo **carga a mano el admin**; el sistema no lo genera ni lo consulta a ninguna API.
- Se guarda tal como salió, **sin reordenar**.

## Los ganadores

- Gana la jugada **no anulada** cuyos 4 números están dentro del extracto, contando
  los repetidos (ver "Cómo se gana" más arriba).
- Si hay **N ganadores**, cada uno cobra `pozo / N`. Con un pozo de $1.500.000 y
  dos ganadores, son $750.000 cada uno — aunque se hayan vendido tres jugadas.
- Si hay **0 ganadores**, el sorteo queda **vacante**: el pozo no se acumula al mes
  siguiente ni se reparte. Queda registrado como vacante y nada más.
- El sistema **no registra si el premio fue efectivamente pagado**. Eso se maneja
  fuera (ver [[decisiones-de-diseno]]).

## El comprobante

- Al cargar una jugada, el sistema emite un **comprobante** que el vendedor le
  entrega al comprador.
- Cada jugada tiene un **código único e irrepetible** con formato `AAMMDD-XXXXXX`:

  ```
  260815-K7M3XQ
  └──┬──┘ └──┬──┘
     │       └── aleatorio, 6 caracteres
     └────────── se cargó el 15/08/2026
  ```

- Los primeros seis dígitos son la **fecha en que se cargó la jugada**, no la de
  hoy: un comprobante regenerado o cargado con fecha anterior conserva la de la
  venta. Y es la fecha **en la hora del club**: con el servidor en UTC, una venta
  de las 21:30 se llevaba impreso el día siguiente.
- La segunda parte es **aleatoria, no correlativa**: si fuera un número
  secuencial, cualquiera podría adivinar los comprobantes ajenos probando
  números cercanos.
- El alfabeto de la parte aleatoria excluye `0`, `1`, `I`, `L`, `O` y `U`, porque
  se confunden entre sí al leerlos de un papel o dictarlos por teléfono. **La
  parte de la fecha sí lleva dígitos**, incluidos 0 y 1: ahí el contexto
  desambigua, y por eso cada mitad se valida por separado.
- **En el papel se imprimen**: el código, los 4 números jugados (formateados a
  dos dígitos), el nombre y el teléfono del comprador, el importe pagado, y las
  dos cosas que son la venta en sí: **el pozo** —el premio que el comprador está
  comprando, y que tiene que quedarle por escrito— y **el día en que se sortea**,
  que es el del cierre de la ventana de carga.

  > La API devuelve además el período, el estado del sorteo, el vendedor y la
  > fecha de carga. **Ninguno de esos cuatro va en el ticket**: son datos del
  > payload, no del papel. Antes esta lista los mezclaba y prometía un
  > comprobante que no existe.

- Presentando el código se puede recuperar la jugada, desde **Consultar
  comprobante**, que está para los dos roles: al comprador que viene a reclamar
  lo atiende el vendedor, no el admin. Si el sorteo ya se finalizó, la pantalla
  dice si ganó y **cuánto cobra** —con el pozo fijo, "ganaste" sin el monto deja
  la pregunta a medias— y marca cuáles de sus números salieron.
- Además de imprimirse, **se manda por WhatsApp**: como foto del ticket o como
  texto con el número de comprobante. Las dos formas hacen falta y por qué está
  en el README del frontend.
- La visibilidad es la misma que para el resto: un vendedor solo puede consultar
  los comprobantes de las jugadas que él cargó; el admin, todos.

## Anulación y corrección

- Una jugada cargada **no puede ser modificada ni anulada por el vendedor**.
- Solo el **admin** puede editar o anular una jugada, desde su panel.
- Anular **no borra la fila**: se marca la jugada, se registra qué admin lo hizo y
  cuándo. Nunca se hace `DELETE` sobre `jugadas`.
- Una jugada anulada deja de contar tanto para el pozo como para los ganadores.
- Anular es **reversible, pero solo mientras el sorteo no esté finalizado.** Con
  el extracto cargado, restaurar una anulada es elegir quién cobra: bastaría con
  anular varias jugadas mientras el sorteo está abierto —cosa legítima y
  habitual— y restaurar después la que salió. Es la misma razón por la que no se
  pueden cambiar los números después del sorteo.
- **Anular sí es posible después del sorteo** (confirmado 2026-08-26). Quitar un
  cobrador no es lo mismo que elegirlo —esa es la diferencia con restaurar, que
  podía fabricar un ganador— y hay un caso real detrás: un comprobante que nunca
  se pagó y se detecta tarde.
- Antes de anular, el sistema **muestra lo que provoca**: a quién le saca el
  premio, cuánto cobraba, y que los demás pasan de `pozo/N` a `pozo/(N-1)`. No se
  prohíbe la operación, se hace visible la consecuencia — el mismo criterio con
  el que se corrige el extracto.
- Toda anulación queda **registrada a nombre de quien la hizo**, y después del
  sorteo ese registro es permanente, porque ya no se puede restaurar.

## Visibilidad

- Un **vendedor** ve únicamente las jugadas que él mismo cargó.
- El **admin** ve todas las jugadas de todos los vendedores.
- Esto incluye los **totales**, no solo el listado: en su pantalla el vendedor ve
  cuántas cargó **él** y cuánto recaudó **él**. El total del sorteo y la
  recaudación de todos son del panel del admin — dárselos al vendedor sería
  contarle cuánto vendieron los demás.
- El **pozo sí lo ve todo el mundo**: es el premio anunciado, lo que el vendedor
  le dice al comprador.

## Números repetidos dentro de una jugada ✅ CONFIRMADO

- Una jugada **puede llevar números repetidos**: `07 07 23 45` es válida, e incluso
  `55 55 55 55`. Confirmado por el usuario (2026-07-31).
- No hay ninguna validación que lo impida, y es a propósito. La normalización
  ascendente funciona igual y el match las trata como cualquier otra combinación.
- Si alguna vez cambia, la validación va en `validarNumeros()`
  (`backend/src/utils/numeros.js`) más un `CHECK` en la tabla.

Detalle de roles y permisos por endpoint en [[tech-stack]].
Estructura de tablas y queries en [[esquema-base-datos]].
