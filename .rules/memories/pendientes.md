# memories/pendientes.md — Qué falta, y en qué orden

> **Prioridades al 2026-08-26.** Este archivo es el orden, no el planteo: el
> *porqué* de cada pendiente vive donde se discutió, y acá va enlazado. Si una
> entrada de esta lista y su detalle se contradicen, **manda el detalle**.

## La escala

| Nivel | Qué significa |
|---|---|
| **CRÍTICA** | Bloquea otras tareas o hay que atenderlo ya |
| **ALTA** | Lo antes posible: hay una ventana temporal o el costo crece solo |
| **MEDIA** | Importa, pero puede esperar a que haya un rato largo |
| **BAJA** | Cuando sobre tiempo |

Hoy no hay ninguna CRÍTICA. El nivel queda para cuando algo esté bloqueando de
verdad — no para subir de tono un pendiente que llevamos semanas postergando.

## El orden

| # | Pendiente | Urgencia | Detalle en |
|---|---|---|---|
| 1 | Decidir si se permite anular después del sorteo | **MEDIA** | [[decisiones-de-diseno]] → Pendiente |
| 2 | Tests de las reglas que están escritas dos veces | **MEDIA** | [[tech-stack]] → Pendiente de definir |
| 3 | Que la anulación deje rastro aunque se restaure | **MEDIA** | [[decisiones-de-diseno]] → Pendiente, opción 4 |
| 4 | Secretos y variables entre Vercel, Render y Supabase | **BAJA** | [[tech-stack]] → Pendiente de definir |
| 5 | Limpiar la clase muerta `no-imprimir` | **BAJA** | `frontend/README.md` → regla de impresión |
| 6 | Partir el bundle del frontend | **BAJA** | [[tech-stack]] → Pendiente de definir |

> **Resuelto el 2026-08-26:** la confirmación al anular una jugada ganadora, que
> encabezaba esta tabla y era el único pendiente con ventana temporal. Detalle en
> [[decisiones-de-diseno]] → "Anular después del sorteo", opción 3.
>
> Sacarlo **no cierra la decisión de fondo**, que es la que quedó primera: el
> cartel avisa lo que estás por hacer, pero si `anular` tiene que seguir siendo
> posible después del sorteo sigue sin responderse.

## Por qué ese orden

**1 — Decidir anular post-sorteo.** No es una tarea de código sino una decisión de
negocio, y no tiene fecha propia. Pero le da la forma al 3, que hasta entonces se
diseñaría a ciegas. Cuesta pensarlo y anotarlo, nada más.

Ya no urge como antes: el cartel de confirmación sacó lo peligroso del asunto
—anular a un cobrador de un solo click y sin enterarte—, así que lo que queda es
la pregunta de fondo, sin apuro.

**2 — Tests de las reglas duplicadas.** Va por encima del 3, aunque el 3 se
planteó antes, porque protege el cálculo con el que se paga y cuesta mucho menos
que tocar el esquema. El repo tiene **dos reglas escritas dos veces cada una**:
`condicionGanadora()` / `esGanadora()` en `utils/ganadores.js`, y el comprobante
maquetado en canvas y en JSX. Cada pareja se desincroniza en silencio: ninguna
pantalla avisa. Unos pocos casos sobre "4 dentro de 20 con repetidos" cubren lo
más caro de equivocar.

**3 — El rastro de la anulación.** El agujero grave —anular y restaurar alrededor
del extracto— ya está cerrado; lo que queda es auditoría. Pero mientras
`restaurar` nulifique `anulada_por` y `anulada_at`, los controles de anulación son
controles sin registro, en un sistema donde se reparte plata. Es el más caro de
la lista: toca el esquema y el `CHECK chk_jugadas_anulacion`.

**4, 5 y 6 — Cuando haya un rato.** Los secretos llevan tiempo anotados y sin
síntoma. `no-imprimir` son cinco atributos que no hacen nada y ya está advertido
en el README, así que el riesgo de confundir a alguien está contenido. El bundle
es una molestia de carga inicial, y el aviso de "servidor despertando" del login
ya ataca la parte de la espera que de verdad se nota.

## Cómo se mantiene esto

- **Acá va una línea por pendiente, no el planteo.** El razonamiento se escribe
  donde corresponde —`decisiones-de-diseno.md` si es de producto,
  `tech-stack.md` si es técnico— y desde acá se enlaza. Duplicar el argumento
  garantiza que las dos copias se contradigan en un mes.
- **Cuando un pendiente se resuelve, se saca de esta tabla** y el detalle queda
  marcado como resuelto donde vive, con lo que se hizo y por qué. Ver
  "Restaurar una jugada después del sorteo" en [[decisiones-de-diseno]] como
  modelo.
- **Las prioridades caducan**: la fecha de arriba es parte del contenido. Una
  lista de hace tres meses ordena según un proyecto que ya no es este.
- **El estado de git no va acá.** Ramas sin mergear, commits sin pushear y demás
  se ven con `git status` y cambian el mismo día; escritos en un `.md`
  versionado quedan mintiendo enseguida.
