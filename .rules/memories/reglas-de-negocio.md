# memories/reglas-de-negocio.md — Reglas del juego (Borratina)

## Qué es

La borratina es un juego de azar tradicional vinculado a la quiniela: lotería poceada,
con modalidad de extractos de quiniela y premios por aciertos numéricos.

## Funcionamiento

- Cada participante elige **4 números de dos cifras** (00-99).
- Los números pueden repetirse: varias personas pueden jugar la misma combinación.
- El sorteo se realiza **una vez por mes**.
- Si una o más personas aciertan la combinación ganadora, el **pozo se reparte en
  partes iguales** entre todos los ganadores.
- Si nadie acierta, el sorteo **queda vacante**.

## Comparación de ganadores: orden libre ✅ CONFIRMADO

> Esta sección reemplaza la asunción anterior de comparación posicional
> (que suponía un extracto de quiniela distinto por posición). **Confirmado por el
> usuario: el orden NO importa.**

- Una jugada gana si tiene **los mismos 4 números que el sorteo, en cualquier orden**.
  `45 07 88 23` y `07 23 45 88` son la misma jugada.
- Implementación: los 4 números se **normalizan en orden ascendente** al guardarse,
  tanto en la jugada como en el resultado del sorteo. La comparación se hace
  posición a posición sobre esa forma ya normalizada, lo que mantiene el índice
  utilizable.
- **No hay premios parciales**: acertar 3 de 4 no paga nada. Es todo o nada.

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
- Una jugada **solo puede cargarse mientras el sorteo está `abierto`**.

## El pozo

```
pozo_total = cantidad de jugadas NO anuladas × precio_jugada
```

- Las jugadas **anuladas no suman al pozo** ni pueden ganar.
- El pozo se calcula en vivo mientras el sorteo está abierto, y se **congela**
  (se persiste en `sorteos.pozo_total`) al finalizarlo, para que el histórico no
  cambie si después se toca alguna jugada.

## El resultado

- El número ganador son **4 números del 00 al 99**, tomados del **resultado oficial
  de la quiniela**.
- Lo **carga a mano el admin**; el sistema no lo genera ni lo consulta a ninguna API.
- Se normaliza en orden ascendente al guardarse, igual que las jugadas.

## Los ganadores

- Gana la jugada **no anulada** cuyos 4 números coinciden con los 4 del sorteo
  (comparados como conjunto, sobre la forma normalizada).
- Si hay **N ganadores**, cada uno cobra `pozo_total / N`.
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
  venta.
- La segunda parte es **aleatoria, no correlativa**: si fuera un número
  secuencial, cualquiera podría adivinar los comprobantes ajenos probando
  números cercanos.
- El alfabeto de la parte aleatoria excluye `0`, `1`, `I`, `L`, `O` y `U`, porque
  se confunden entre sí al leerlos de un papel o dictarlos por teléfono. **La
  parte de la fecha sí lleva dígitos**, incluidos 0 y 1: ahí el contexto
  desambigua, y por eso cada mitad se valida por separado.
- El comprobante incluye: código, los 4 números jugados (formateados a dos
  dígitos), nombre y teléfono del comprador, período del sorteo, importe pagado,
  vendedor y fecha de carga.
- Presentando el código se puede recuperar la jugada. Si el sorteo ya se
  finalizó, además se informa si esa jugada ganó.
- La visibilidad es la misma que para el resto: un vendedor solo puede consultar
  los comprobantes de las jugadas que él cargó; el admin, todos.

## Anulación y corrección

- Una jugada cargada **no puede ser modificada ni anulada por el vendedor**.
- Solo el **admin** puede editar o anular una jugada, desde su panel.
- Anular es **reversible** y **no borra la fila**: se marca la jugada, se registra
  qué admin lo hizo y cuándo. Nunca se hace `DELETE` sobre `jugadas`.
- Una jugada anulada deja de contar tanto para el pozo como para los ganadores.

## Visibilidad

- Un **vendedor** ve únicamente las jugadas que él mismo cargó.
- El **admin** ve todas las jugadas de todos los vendedores.

## Punto abierto

- **¿Puede una misma jugada tener números repetidos internamente?** (ej: `07 07 23 45`).
  Hoy el backend **lo permite** — la normalización ascendente funciona igual. Si el
  juego real exige 4 números distintos, hay que agregar la validación en
  `validarNumeros()` y un `CHECK` en la tabla. Confirmar con el usuario.

Detalle de roles y permisos por endpoint en [[tech-stack]].
Estructura de tablas y queries en [[esquema-base-datos]].
