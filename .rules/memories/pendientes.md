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
| 1 | Tests de las reglas que están escritas dos veces | **MEDIA** | [[tech-stack]] → Pendiente de definir |
| 2 | Que la anulación deje rastro aunque se restaure | **MEDIA** | [[decisiones-de-diseno]] → Pendiente, opción 4 |
| 3 | Secretos y variables entre Vercel, Render y Supabase | **BAJA** | [[tech-stack]] → Pendiente de definir |
| 4 | Limpiar la clase muerta `no-imprimir` | **BAJA** | `frontend/README.md` → regla de impresión |
| 5 | Partir el bundle del frontend | **BAJA** | [[tech-stack]] → Pendiente de definir |

> **Cerrados el 2026-08-26**, los dos que encabezaban esta tabla:
>
> - **La confirmación al anular una ganadora** — hecha. Era el único pendiente
>   con ventana temporal. Detalle en [[decisiones-de-diseno]] → "Anular después
>   del sorteo", opción 3.
> - **Si anular post-sorteo tiene que seguir siendo posible** — decidido que sí,
>   sin cambio de código. Con el cartel avisando la consecuencia y el rastro
>   permanente (post-sorteo ya no se puede restaurar), el caso real a favor pesó
>   más que el riesgo. La opción 2 quedó descartada de paso.
>
> Lo que quedó abierto de todo eso es solo el rastro de una anulación revertida,
> que es el punto 2 de ahora y toca el esquema.

## Por qué ese orden

**1 — Tests de las reglas duplicadas.** Va por encima del 2, aunque el 2 se
planteó antes, porque protege el cálculo con el que se paga y cuesta mucho menos
que tocar el esquema. El repo tiene **dos reglas escritas dos veces cada una**:
`condicionGanadora()` / `esGanadora()` en `utils/ganadores.js`, y el comprobante
maquetado en canvas y en JSX. Cada pareja se desincroniza en silencio: ninguna
pantalla avisa. Unos pocos casos sobre "4 dentro de 20 con repetidos" cubren lo
más caro de equivocar.

**2 — El rastro de la anulación.** El agujero grave —anular y restaurar alrededor
del extracto— ya está cerrado; lo que queda es auditoría. Es el más caro de la
lista: toca el esquema y el `CHECK chk_jugadas_anulacion`.

Desde el 2026-08-26 la pantalla **muestra quién anuló y cuándo**, así que la
mitad visible está. Falta la otra: mientras `restaurar` nulifique `anulada_por` y
`anulada_at`, un anular-y-restaurar no deja constancia de que pasó. Se ve quién
anuló una jugada que **sigue** anulada, no quién anuló una que después se
restauró. Con varios admins es justo el caso que se querría poder reconstruir.

Alcanza solo a los **sorteos abiertos**: una vez sorteado no se puede restaurar,
así que ahí el registro ya es permanente.

**3, 4 y 5 — Cuando haya un rato.** Los secretos llevan tiempo anotados y sin
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
