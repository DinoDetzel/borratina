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
| 1 | Confirmación al anular una jugada ganadora | **ALTA** | [[decisiones-de-diseno]] → Pendiente, opción 3 |
| 2 | Decidir si se permite anular después del sorteo | **MEDIA** | [[decisiones-de-diseno]] → Pendiente |
| 3 | Tests de las reglas que están escritas dos veces | **MEDIA** | [[tech-stack]] → Pendiente de definir |
| 4 | Que la anulación deje rastro aunque se restaure | **MEDIA** | [[decisiones-de-diseno]] → Pendiente, opción 4 |
| 5 | Secretos y variables entre Vercel, Render y Supabase | **BAJA** | [[tech-stack]] → Pendiente de definir |
| 6 | Limpiar la clase muerta `no-imprimir` | **BAJA** | `frontend/README.md` → regla de impresión |
| 7 | Partir el bundle del frontend | **BAJA** | [[tech-stack]] → Pendiente de definir |

## Por qué ese orden

**1 — Confirmación al anular una ganadora.** Es la única con ventana temporal. La
pantalla del sorteo pinta el chip *Ganadora* y ofrece el botón de anular en la
misma celda, sin confirmación, a un click: te dice quién cobra y te da el botón
para sacarlo. El sistema ya está en producción, así que esto conviene tenerlo
**antes de que se cargue el primer extracto con premios repartiéndose**.

Va primera además porque **no depende del pendiente 2**: un cartel que diga a quién
le sacás el premio y cuánto sirve igual, se termine permitiendo anular post-sorteo
o no. Es una pantalla y nada más.

**2 — Decidir anular post-sorteo.** No es una tarea de código sino una decisión de
negocio, y no tiene fecha propia. Pero le da la forma al 4, que hasta entonces se
diseñaría a ciegas. Cuesta pensarlo y anotarlo, nada más.

**3 — Tests de las reglas duplicadas.** Va por encima del 4, aunque el 4 se
planteó antes, porque protege el cálculo con el que se paga y cuesta mucho menos
que tocar el esquema. El repo tiene **dos reglas escritas dos veces cada una**:
`condicionGanadora()` / `esGanadora()` en `utils/ganadores.js`, y el comprobante
maquetado en canvas y en JSX. Cada pareja se desincroniza en silencio: ninguna
pantalla avisa. Unos pocos casos sobre "4 dentro de 20 con repetidos" cubren lo
más caro de equivocar.

**4 — El rastro de la anulación.** El agujero grave —anular y restaurar alrededor
del extracto— ya está cerrado; lo que queda es auditoría. Pero mientras
`restaurar` nulifique `anulada_por` y `anulada_at`, los controles de anulación son
controles sin registro, en un sistema donde se reparte plata. Es el más caro de
la lista: toca el esquema y el `CHECK chk_jugadas_anulacion`.

**5, 6 y 7 — Cuando haya un rato.** Los secretos llevan tiempo anotados y sin
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
