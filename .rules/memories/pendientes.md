# memories/pendientes.md — Qué falta, y en qué orden

> **Prioridades al 2026-08-27.** Este archivo es el orden, no el planteo: el
> *porqué* de cada pendiente vive donde se discutió, y acá va enlazado. Si una
> entrada de esta lista y su detalle se contradicen, **manda el detalle**.

## La escala

| Nivel | Qué significa |
|---|---|
| **CRÍTICA** | Bloquea otras tareas o hay que atenderlo ya |
| **ALTA** | Lo antes posible: hay una ventana temporal o el costo crece solo |
| **MEDIA** | Importa, pero puede esperar a que haya un rato largo |
| **BAJA** | Cuando sobre tiempo |

Los niveles altos quedan para cuando algo esté bloqueando de verdad, no para
subir de tono un pendiente que llevamos semanas postergando.

## Lo que falta

**No queda nada de producto, ni nada de urgencia media o mayor.** Los dos que
siguen son deuda técnica sin síntoma y ninguno bloquea nada.

Van sin numerar a propósito: el número salía de la posición en la tabla y se
reciclaba cada vez que se cerraba algo, así que "el punto 1" significaba una cosa
distinta cada semana. Se nombran por lo que son.

| Pendiente | Urgencia | Detalle en |
|---|---|---|
| Secretos y variables entre Vercel, Render y Supabase | **BAJA** | [[tech-stack]] → Pendiente de definir |
| Ver el comprobante renderizado, no solo su contenido | **BAJA** | `frontend/README.md` → la imagen en canvas |

## Por qué están donde están

**Los secretos entre Vercel, Render y Supabase.** Llevan tiempo anotados y sin
síntoma: hoy se cargan a mano en cada panel y funciona. Se volvería urgente si
entra alguien más al proyecto o si hay que rotar el `JWT_SECRET`.

**Ver el comprobante renderizado.** Los tests de sincronía cubren que las dos
versiones digan lo mismo, pero no que se vean igual: posiciones, tamaños y
espaciados siguen sin red. Haría falta render en headless y comparación de
imágenes, que es mucha maquinaria para un riesgo que además avisa solo — un
ticket descuadrado se ve a simple vista la primera vez que se manda uno.

## Cerrados

**2026-08-27**

- **Los tests ahora corren solos.** `.github/workflows/ci.yml`, con un Postgres
  de servicio. Lo que de verdad cerró el agujero no fue el workflow sino que
  **con `CI` puesto los tests dejan de saltearse y fallan**: un `describe`
  salteado registra *cero* tests, así que la suite adelgazaba sin que ningún
  contador lo notara. El workflow exige además `# skipped 0` y un piso de tests
  corridos. Detalle en [[tech-stack]] → "En CI se corren todos".

- **Las fechas del gráfico salían corridas un día.** `fechaCorta()` metía el día
  del backend —texto `AAAA-MM-DD`, mandado así justamente para que no se corriera—
  en un `new Date()`, que lo lee como medianoche UTC: en Buenos Aires el eje decía
  14/08 donde el backend decía 15/08. Ahora pasa por `aFecha()`. Detalle en
  `frontend/README.md` → "Una fecha sin hora nunca va derecho a `new Date()`".
- **El login no tenía freno de fuerza bruta.** 10 fallos por cuenta y 15 minutos
  de espera, contados **por usuario y no por IP** para no dejar afuera a todos los
  vendedores que comparten la red del club. Detalle en [[tech-stack]] →
  "Arquitectura general".
- **`TZ_CLUB` estaba cableado a medias.** Lo respetaba solo el pool de Postgres:
  el resto del backend y **todo** el frontend formateaban en la zona del servidor
  o del dispositivo, así que la variable era decorativa y un vendedor con el
  teléfono en otra zona veía un día distinto del impreso. Ahora la manda el
  backend con el usuario y rige en todo lo que se muestra. Detalle en
  [[tech-stack]] → "Estructura del backend".
- **Los permisos no los verificaba nada.** `test/rutas.test.js` levanta la API y
  cubre quién ve qué y los candados post-sorteo: son reglas que viven en un
  `WHERE` y en un `if`, sin ningún `CHECK` detrás. Piden `TEST_DATABASE_URL`.
- **`GET /jugadas/comprobante/:codigo` no tenía pantalla.** Devolvía `gano` y el
  extracto y nadie los leía. Ahora está **Consultar comprobante**, para los dos
  roles, y el endpoint agrega cuánto cobra. Detalle en [[reglas-de-negocio]] →
  "El comprobante".
- **Los tests del comprobante.** Sincronía entre el canvas y el JSX: que consuman
  los mismos datos y digan los mismos textos. No hizo falta DOM ni navegador, se
  comparan los fuentes. Queda afuera cómo se ven, que pasó a ser su propio
  pendiente.
- **Partir el bundle.** `React.lazy` sobre el gráfico: la carga inicial pasó de
  195 kB gzip a 91 kB. El vendedor ya no se baja Recharts para cargar una jugada.
- **La clase muerta `no-imprimir`.** Sacada de los cinco lugares del JSX donde
  seguía puesta sin ninguna regla CSS detrás. Nada que ver en pantalla: la
  impresión ya se resolvía escondiendo todo menos el comprobante.
- **El rastro de la anulación.** Migración 013: `jugadas_eventos` guarda quién
  anuló y quién restauró, y sobrevive a las restauraciones. Era el último
  pendiente de producto. Detalle en [[decisiones-de-diseno]] → "El rastro de la
  anulación".

**2026-08-26**

- **La confirmación al anular.** Primero solo para las ganadoras, con el reparto
  a la vista; después para todas. Era el único pendiente con ventana temporal.
- **Si anular post-sorteo tiene que seguir siendo posible.** Decidido que sí, sin
  cambio de código: el caso real a favor pesó más que el riesgo, con el cartel
  avisando y el rastro permanente. La opción 2 quedó descartada de paso.
- **Los tests de la regla de ganadores.** Con `node:test`. La paridad entre
  `condicionGanadora()` y `esGanadora()` se verifica contra un Postgres real.

## Cómo se mantiene esto

- **Acá va una línea por pendiente, no el planteo.** El razonamiento se escribe
  donde corresponde —`decisiones-de-diseno.md` si es de producto,
  `tech-stack.md` si es técnico— y desde acá se enlaza. Duplicar el argumento
  garantiza que las dos copias se contradigan en un mes.
- **Cuando un pendiente se resuelve, se saca de la tabla** y pasa a "Cerrados"
  con su fecha; el detalle queda marcado como resuelto donde vive. Ver
  "Restaurar una jugada después del sorteo" en [[decisiones-de-diseno]] como
  modelo.
- **Las prioridades caducan**: la fecha de arriba es parte del contenido. Una
  lista de hace tres meses ordena según un proyecto que ya no es este.
- **El estado de git no va acá.** Ramas sin mergear, commits sin pushear y demás
  se ven con `git status` y cambian el mismo día; escritos en un `.md`
  versionado quedan mintiendo enseguida.
