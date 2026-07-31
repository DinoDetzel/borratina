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
