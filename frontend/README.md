# Frontend — Borratina Digital

React + Vite. Consume la API de `../backend`.

## Puesta en marcha

```bash
npm install
npm run dev     # http://localhost:5173
```

Necesita el backend corriendo en `http://localhost:3000`. En desarrollo no hace
falta configurar nada: Vite redirige `/api` al backend (ver `vite.config.js`), así
que no hay CORS ni URLs hardcodeadas. Con `BACKEND_URL` se apunta el proxy a otro
lado, que sirve para probar la app contra una base de prueba sin tocar la de
desarrollo.

### Probar desde el teléfono (HTTPS local)

Compartir la foto del comprobante usa la Web Share API, que **solo existe en
contexto seguro**: sobre `http://` con la IP de la red el navegador ni la expone.
Si hay certificados puestos en `certs/`, Vite levanta en HTTPS solo:

```bash
openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 825 \
  -keyout certs/clave.pem -out certs/certificado.pem \
  -subj "/CN=Borratina LAN" \
  -addext "subjectAltName=IP:<tu-ip>,IP:127.0.0.1,DNS:localhost"
```

La IP tiene que estar en el `subjectAltName`: sin eso los navegadores rechazan el
certificado aunque el nombre coincida. `certs/` va en el `.gitignore` — son
certificados de andar por casa y no se versionan.

## Las dos pantallas

**Vendedor** (`/cargar`) — deliberadamente simple, es lo único que ve: formulario
de carga, el comprobante que se imprime al cargar, y el listado de sus propias
jugadas. Sin estadísticas: eso es del admin.

### Está pensada para el teléfono

El vendedor la usa parado en la calle, con una mano. Por eso:

- **El formulario va primero**, antes de cualquier métrica. Lo que lleva cargado y
  recaudado queda abajo del botón, en una línea. Entra a cargar, no a mirar
  números.
- **Al escribir dos dígitos el foco salta solo** al siguiente campo: se cargan
  muchas jugadas seguidas.
- Los campos numéricos son **grandes** y el botón ocupa el ancho completo.
- Los `input` tienen **16px en móvil**: por debajo de eso, iOS hace zoom al
  enfocar el campo y descoloca toda la pantalla.
- El listado deja de ser tabla y **pasa a ser una lista**: cuatro columnas en
  390px obligaban a scrollear de costado para leer el nombre del comprador.

Si tocás esta pantalla, revisala en un viewport angosto antes de darla por buena.

**El admin usa la misma pantalla, y ahí el título tiene que decir la verdad.** El
backend no le filtra las jugadas ajenas, así que antes el listado decía "Mis
jugadas" y mostraba las de todos. Ahora el admin elige entre **Mías** y **De
todos**: el título cambia con la elección y la columna "Vendedor" aparece solo
cuando está viendo las de todos. Al vendedor no se le ofrece la opción, porque el
backend le da lo suyo y punto.

Debajo del botón, el admin ve además el total del sorteo (`jugadas_cargadas` y
`recaudacion`, que la API manda solo a los admins). El vendedor sigue viendo
únicamente lo suyo.

El **panel** no es una pila de tarjetas iguales: arriba va el pozo grande con la
cobertura al costado (`.panel-hero`, dos columnas desparejas separadas por una
línea), después tres fichas chicas, y después el gráfico junto al ranking por
vendedor (`.panel-fila`). El ritmo ancho/angosto es lo que hace que se lea de
arriba abajo sin que todo pese lo mismo.

**Las listas largas se traen de a páginas y lo dicen.** Tanto el buscador de
jugadas como el detalle de un sorteo muestran "N de M · Ver más". Antes el
buscador pedía las primeras 100 y el encabezado decía el total, así que una
búsqueda con más resultados se cortaba en silencio.

Las tarjetas partidas en dos (el pozo con su cobertura, el sorteo abierto con su
pozo y sus fechas) comparten `.partida`: dos columnas con una línea al medio que
en pantalla angosta se apilan y la línea pasa a ser horizontal.

**El comprobante es el talonario del club, reproducido tal cual.** Por eso sus
medidas van en píxeles y no en variables del sistema: no es una pantalla más, es
una pieza impresa que tiene que salir siempre igual, sin que la mueva un ajuste
de tipografía hecho para otra cosa. El ancho fijo de 720px se escala con `zoom`
en pantallas angostas, que es la única forma de achicarlo sin deformar las
proporciones del diseño.

Las tipografías del comprobante (Yellowtail y Barlow) van **con la app y no desde
un CDN**: el vendedor imprime en la calle y el comprobante tiene que verse igual
sin conexión. Están en `src/fuentes/` junto con las de la app (Inter y Oswald),
solo el subconjunto latino: nueve archivos, ~228 kB en total.

Al imprimir se oculta todo por `visibility` menos el comprobante. Tiene que ser
`visibility` y no `display`, porque el comprobante cuelga del formulario de
carga: ocultando por `display` desaparecería con él.

**El comprobante se manda por WhatsApp de dos formas, y las dos hacen falta.**

*La foto* es lo que se usa casi siempre: el comprador recibe el ticket como lo
vería en papel. WhatsApp **no acepta adjuntos por URL** —`wa.me` solo lleva
texto—, así que la única vía es la Web Share API con archivos: se abre el
selector del sistema y el contacto lo elige el vendedor.

*El texto* queda como segunda opción y no es un plan B pobre: abre el chat del
comprador directamente y le deja el número de comprobante como texto, que se
puede copiar y buscar en el chat dentro de un mes, cuando venga a cobrar. Dentro
de una imagen ese número no se busca.

**La imagen se dibuja a mano en un canvas** (`comprobanteImagen.js`), no se
captura el DOM: `html2canvas` no soporta `clip-path: path()` y el escudo saldría
como un rectángulo; `html-to-image` usa `foreignObject`, que en Safari devuelve
imágenes en blanco o sin tipografías, y un comprobante que a veces sale vacío es
peor que ninguno. El costo es que la maqueta está escrita dos veces —canvas y
JSX—: **si se toca una, hay que tocar la otra.** Las medidas son las mismas y en
el mismo orden para que compararlas sea directo.

**Ojo al probar en el teléfono:** la Web Share API exige contexto seguro. Sobre
`https://` (producción) anda; sobre `http://<ip-de-la-lan>` el navegador ni
expone `navigator.share` y el botón cae en descargar el PNG. Lo más parecido a
producción es levantar Vite en HTTPS con certificados propios (ver "Probar desde
el teléfono", arriba). La otra vía, si no querés generar certificados, es
`chrome://flags/#unsafely-treat-insecure-origin-as-secure` en Android: agregar ahí
el origen y reiniciar el navegador.

`whatsapp.js` arma el enlace `wa.me` del texto. Si el teléfono del comprador se
puede normalizar, abre su chat directo; si no, WhatsApp pide elegir el contacto.
**No adivina**: antes que abrir el chat equivocado con los datos de una jugada
ajena, prefiere que el vendedor elija. La pantalla dice de antemano a qué número
va.

**Las fechas con hora van en dos controles, no en un `datetime-local`.**
`CampoFechaHora` es un `input type="date"` más una lista de horas. El campo
combinado se manejaba mal: los segmentos se recorren con las flechas sin saber
en cuál estás, al año no se llega, y pasando la hora caés en el AM/PM, donde
subir y bajar solo alterna entre dos valores. La lista de horas va de media en
media hora e incluye el valor que ya tenga el sorteo aunque no caiga en la media,
para no pisarle la configuración a nadie por abrir la pantalla.

Cuando una fila tiene más de dos acciones, van como texto (`.enlace`) y no como
botones con borde: cuatro cajitas repetidas en cada fila convierten la tabla en
una pared. El rojo se reserva para la única que no se puede deshacer.

Las tablas anchas llevan `.tabla-a-lista` y en el teléfono dejan de ser tabla:
cada fila pasa a ser un bloque. Como ahí no hay encabezados, los valores que
solos no se entienden llevan `data-movil="Pozo"` y el nombre aparece adelante; y
lo que directamente no entra (los 20 números de un extracto) lleva
`oculta-en-movil`.

Ojo con `.tarjeta + .tarjeta { margin-top }` cuando las tarjetas van dentro de
una grilla: ahí la separación la da el `gap`, y el margen extra deja la primera
tarjeta desalineada del resto. Por eso está anulado en `.grilla` y `.panel-fila`.

**Admin** — panel con el pozo, evolución de ventas e historial (`/admin`), gestión
de sorteos (`/admin/sorteos`), detalle de un sorteo (`/admin/sorteos/:id`), todas
las cuentas y qué cargó cada una (`/admin/vendedores`) y alta de cuentas
(`/admin/usuarios`).

El detalle de un sorteo es la pantalla que se mira cuando se sortea: el extracto,
si hubo ganadores o quedó vacante, quiénes cobran y todas las jugadas cargadas,
con los números que estaban en el extracto en verde. **El buscador de jugadas vive
acá**, y desde acá se anula, se restaura, se corrige y se reenvía el comprobante.

Antes había además una pantalla `/admin/jugadas` con la lista de todas las jugadas
y un selector de sorteo. Decía lo mismo que el detalle, así que se eliminó: el
sorteo se elige entrando al sorteo, no desde un desplegable.

`/admin/vendedores` y `/admin/usuarios` no son la misma pantalla. La segunda es el
ABM de cuentas; la primera contesta quién **no** está vendiendo, así que lista
también las inactivas y las que no cargaron nada. Lleva el sorteo en la URL
(`?sorteo=`) para poder llegar desde el panel sin perder cuál estaba elegido y
para que el enlace se pueda compartir. Como el detalle de un sorteo, no va en la
barra de navegación: se llega desde el panel.

## Estructura

```
src/
├── main.jsx           # montaje: router + contexto de auth
├── App.jsx            # rutas y layout
├── api.js             # cliente HTTP, token, manejo de 401
├── auth.jsx           # contexto de sesión
├── utilidades.js      # formato de números, pesos, fechas y períodos
├── comprobanteImagen.js  # dibuja el comprobante en un canvas, para compartirlo
├── whatsapp.js        # enlace wa.me + Web Share API
├── estilos.css        # tokens de color y estilos
├── fuentes.css        # @font-face de las tipografías locales
├── fuentes/           # los .woff2: Inter, Oswald, Barlow, Yellowtail
├── componentes/
│   ├── comunes.jsx        # Bolillas, Chip, Ficha, Dialogo, mensajes
│   ├── Comprobante.jsx    # el ticket del comprador (imprimible)
│   ├── BotonCompartir.jsx # manda el comprobante, esté a la vista o no
│   ├── CampoFechaHora.jsx # date + lista de horas, en vez de datetime-local
│   ├── CamposExtracto.jsx # los 20 casilleros del extracto
│   └── GraficoVentas.jsx  # evolución diaria + su tabla equivalente
└── paginas/
    ├── Login.jsx
    ├── Vendedor.jsx
    ├── AdminDashboard.jsx
    ├── AdminSorteos.jsx
    ├── AdminSorteoDetalle.jsx
    ├── AdminVendedores.jsx
    └── AdminUsuarios.jsx
```

`BotonCompartir` recibe **el comprobante ya armado** (el que se acaba de emitir) o
**el código** de una jugada de la lista, y en ese caso se lo pide al servidor al
tocarlo. Es a propósito: la lista no trae los datos del sorteo —pozo, fecha,
precio— y armarlo con el sorteo que está en pantalla saldría mal justo en el caso
que importa, porque una jugada del mes pasado llevaría impreso el pozo de este mes.

## Lo que hay que tener en cuenta al tocar esto

**Las rutas por rol son comodidad, no seguridad.** `<Protegida soloAdmin>` evita
mostrar pantallas que no corresponden, pero quien decide es el backend, que valida
el rol en cada endpoint. Nunca confiar en el `rol` del frontend para nada que
importe.

**El token se revalida al abrir la app.** Si está vencido o la cuenta fue dada de
baja, `GET /auth/me` falla y la sesión se cierra sola. Cualquier 401 en cualquier
request dispara lo mismo.

**El login avisa cuando el servidor está despertando.** El backend duerme sin
tráfico (free tier de Render) y el primer request del día tarda hasta un minuto.
Sin aviso, el botón se queda en "Ingresando…", la espera se lee como que la app se
colgó, el vendedor recarga y con eso vuelve a empezar la cuenta. A los 6 segundos
—bastante más que un login normal, así que en el uso diario no llega a aparecer—
sale un cartel debajo del botón, no arriba del formulario: es sobre lo que está
pasando recién ahora, no sobre lo que hay que completar.

**El sistema de diseño está declarado en `:root`, en `estilos.css`, y todo lo
demás lo consume desde ahí.** Los nombres viejos (`--tinta`, `--linea`,
`--serie-1`…) siguen existiendo apuntando a los del sistema: así el rediseño no
obligó a tocar cada regla, y cambiar un color se sigue haciendo en un solo lugar.

El look es de club: crema en vez de blanco, terracota como primario, bordes
cálidos, esquinas moderadas y **sin sombras** — la separación la dan el borde y
el fondo. Los títulos y los números grandes van en **Oswald** (condensada, es lo
que le da el carácter de tablero) y el resto en **Inter**. Las dos viajan con la
app, no desde el CDN de Google, por lo mismo que las del comprobante.

**No hay un rojo de peligro aparte.** El primario ya es rojo y dos rojos
distintos en la misma pantalla no se distinguen, así que lo destructivo se marca
con el tono oscuro y, sobre todo, con el cartel de confirmación. Las acciones de
fila son de texto, no botones con borde.

**La app es de tema claro.** El modo oscuro se retiró con el rediseño: la paleta
nueva se define sobre un fondo crema y no tiene equivalentes oscuros; inventarlos
habría sido diseñar otra cosa.

**El color del gráfico está validado** para contraste (≥3:1 sobre la superficie)
con `scripts/validate_palette.js` de la skill de dataviz. El gráfico lee
`--serie-1` como variable CSS, así que cambiar el color se hace en un solo lugar.
Si se agregan series, hay que revalidar la paleta antes: dos tonos elegidos a ojo
suelen ser indistinguibles para quien tiene deuteranopía.

**El estado nunca se comunica solo con color.** Los `Chip` llevan siempre la
palabra al lado del punto de color, y el gráfico tiene una vista de tabla
equivalente.

**Se imprime solo el comprobante.** La regla `@media print` de `estilos.css`
esconde **toda la página** (`body * { visibility: hidden }`) y vuelve a mostrar
únicamente `.comprobante-club`. Antes se listaban a mano los bloques a ocultar con
una clase `no-imprimir` y salía impresa la pantalla entera —el pozo, el
formulario, los avisos— cada vez que aparecía algo nuevo que nadie se había
acordado de marcar.

Por eso **no hay nada que marcar para excluir de la impresión**: lo que no sea el
comprobante ya queda afuera. Si aparece una clase `no-imprimir` en algún lado, es
un resto de aquel enfoque y no hace nada.

## Deploy en Vercel

- Framework: Vite. Build: `npm run build`. Output: `dist`.
- Variable `VITE_API_URL` con la URL del backend en Render (sin barra final).
  Sin ella, el front pega a `/api` del mismo dominio, que en Vercel no existe.
- El `CORS_ORIGIN` del backend tiene que incluir el dominio de Vercel.
