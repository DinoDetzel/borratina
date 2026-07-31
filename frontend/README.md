# Frontend — Borratina Digital

React + Vite. Consume la API de `../backend`.

## Puesta en marcha

```bash
npm install
npm run dev     # http://localhost:5173
```

Necesita el backend corriendo en `http://localhost:3000`. En desarrollo no hace
falta configurar nada: Vite redirige `/api` al backend (ver `vite.config.js`), así
que no hay CORS ni URLs hardcodeadas.

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
de sorteos (`/admin/sorteos`), detalle de un sorteo (`/admin/sorteos/:id`),
buscador de jugadas con corregir y anular (`/admin/jugadas`) y alta de cuentas
(`/admin/usuarios`).

El detalle de un sorteo es la pantalla que se mira cuando se sortea: el extracto,
si hubo ganadores o quedó vacante, quiénes cobran y todas las jugadas cargadas,
con los números que estaban en el extracto en verde.

## Estructura

```
src/
├── main.jsx           # montaje: router + contexto de auth
├── App.jsx            # rutas y layout
├── api.js             # cliente HTTP, token, manejo de 401
├── auth.jsx           # contexto de sesión
├── utilidades.js      # formato de números, pesos, fechas y períodos
├── estilos.css        # tokens de color y estilos
├── componentes/
│   ├── comunes.jsx        # Bolillas, Chip, fichas, mensajes
│   ├── Comprobante.jsx    # el ticket del comprador (imprimible)
│   └── GraficoVentas.jsx  # evolución diaria + su tabla equivalente
└── paginas/
    ├── Login.jsx
    ├── Vendedor.jsx
    ├── AdminDashboard.jsx
    ├── AdminSorteos.jsx
    ├── AdminSorteoDetalle.jsx
    ├── AdminJugadas.jsx
    └── AdminUsuarios.jsx
```

## Lo que hay que tener en cuenta al tocar esto

**Las rutas por rol son comodidad, no seguridad.** `<Protegida soloAdmin>` evita
mostrar pantallas que no corresponden, pero quien decide es el backend, que valida
el rol en cada endpoint. Nunca confiar en el `rol` del frontend para nada que
importe.

**El token se revalida al abrir la app.** Si está vencido o la cuenta fue dada de
baja, `GET /auth/me` falla y la sesión se cierra sola. Cualquier 401 en cualquier
request dispara lo mismo.

**Los colores del gráfico salen de una paleta validada** para daltonismo y
contraste (≥3:1 sobre la superficie en modo claro y oscuro). Los tokens están en
`estilos.css`; el gráfico los lee como variables CSS, así que cambiar un color se
hace en un solo lugar. Si se agregan series, hay que revalidar la paleta antes:
dos hues elegidos a ojo suelen ser indistinguibles para quien tiene deuteranopía.

**El estado nunca se comunica solo con color.** Los `Chip` llevan siempre la
palabra al lado del punto de color, y el gráfico tiene una vista de tabla
equivalente.

**Se imprime solo el comprobante.** La regla `@media print` de `estilos.css`
esconde todo lo que tenga la clase `no-imprimir`.

## Deploy en Vercel

- Framework: Vite. Build: `npm run build`. Output: `dist`.
- Variable `VITE_API_URL` con la URL del backend en Render (sin barra final).
  Sin ella, el front pega a `/api` del mismo dominio, que en Vercel no existe.
- El `CORS_ORIGIN` del backend tiene que incluir el dominio de Vercel.
