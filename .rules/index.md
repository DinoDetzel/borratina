# index.md — Borratina Digital

Mapa de navegación del proyecto. Define las reglas maestras que rigen a los demás archivos.

## Los cinco archivos

**`skills/`** → el *cómo* se construye.

| Archivo | Qué contesta |
|---|---|
| [[tech-stack]] | Stack, arquitectura, permisos por endpoint, convenciones, tests |

**`memories/`** → el *qué* y el *porqué*.

| Archivo | Qué contesta |
|---|---|
| [[reglas-de-negocio]] | Cómo funciona el juego: cómo se gana, el pozo, el sorteo, el comprobante |
| [[decisiones-de-diseno]] | Qué se decidió, cuándo y por qué — incluido lo que se descartó |
| [[esquema-base-datos]] | Las tablas y el porqué de cada migración |
| [[pendientes]] | Qué falta y en qué orden |

**Por dónde empezar:** qué falta está en [[pendientes]]. El porqué de cada cosa
vive en el archivo donde se planteó, y desde ahí se enlaza.

> **Ojo con `reglas-de-negocio` y `decisiones-de-diseno`:** la línea entre los dos
> no está bien trazada y hay temas que viven en los dos —los números repetidos, la
> anulación, la hora del club—. Eso ya causó una contradicción real: la sección
> "Comparación de números" de [[decisiones-de-diseno]] estuvo un mes describiendo
> el modelo anterior a la migración 007 mientras los otros tres archivos decían lo
> correcto. Ante una discrepancia sobre **cómo funciona hoy**, mandan
> [[reglas-de-negocio]] y [[esquema-base-datos]].

## Resumen del proyecto

Digitalización de la **borratina**, un juego de azar tradicional vinculado a la quiniela.
Los vendedores cargan jugadas (números + datos del comprador) a través de una web,
y el sistema guarda todo en una base de datos para determinar ganadores cuando sale
el resultado del sorteo mensual.

**El sistema está en producción**, con comprobantes reales en manos de
compradores. Eso **cambia qué migraciones son aceptables**: nada que reescriba
códigos de comprobante ya emitidos. Ver [[esquema-base-datos]] → migración 012.

> Acá **no va una tabla de estado**. Había una, con el conteo de migraciones y
> qué estaba cerrado y qué no, y envejeció exactamente como avisa
> [[pendientes]]: llegó a contar doce migraciones cuando ya había trece, y a
> decir "a definir" sobre dos cosas ya decididas. Era estado duplicado de otros
> archivos, y la copia de acá era la única sin nadie que la mantuviera.
>
> Lo que falta está en [[pendientes]]. Cuántas migraciones hay, en
> `backend/db/migrations/`. Qué stack se usa, en [[tech-stack]].

## Reglas maestras

- Toda nueva regla de negocio o decisión de producto se registra en `memories/reglas-de-negocio.md` o `memories/decisiones-de-diseno.md`, según corresponda.
- Todo pendiente que sobreviva a la sesión en que apareció entra en `memories/pendientes.md`, con su urgencia y un enlace al archivo donde está el planteo. Ahí va el orden, nunca el argumento: duplicarlo garantiza que las dos copias se contradigan.
- Todo cambio de stack, convención de código o arquitectura se registra en `skills/tech-stack.md`.
- El esquema de base de datos vive en `memories/esquema-base-datos.md`. Ya existen migraciones reales: la fuente de verdad ejecutable es `backend/db/migrations/`, y el `.md` documenta el porqué de cada decisión. Si cambia una, cambian los dos.
- Antes de escribir código nuevo, revisar `memories/` para no contradecir una decisión ya tomada.
- Los 4 números de una **jugada** se guardan siempre normalizados en orden ascendente, y nada inserta en `jugadas` sin pasar por `utils/numeros.js`. El **extracto del sorteo no se normaliza**: se guarda como se publicó. Son dos tratamientos distintos a propósito — ver [[esquema-base-datos]].
- La regla de quién gana vive **solo** en `backend/src/utils/ganadores.js`, en dos formas que tienen que dar siempre lo mismo: `condicionGanadora()` (SQL) y `esGanadora()` (JS). Si se toca una, se toca la otra.
- Todo lo que sea "qué día es" se resuelve en la **zona horaria del club**, no en la del servidor ni en la del teléfono: `TZ_CLUB` en `config.js`, aplicada en el pool (`db.js`), en los mensajes con fecha del backend, y en el frontend, que la recibe con el usuario. La **única excepción** es la fecha del código de comprobante, que lleva la zona escrita adentro de `generar_codigo_jugada()` (migración 012) porque sale impresa en un papel. Detalle en [[tech-stack]].
- Los archivos de `.rules` se enlazan entre sí por nombre, entre corchetes dobles. El CI verifica que ninguno apunte a un archivo inexistente, que cada migración tenga su fila en [[esquema-base-datos]], y que las rutas de código que se mencionan existan (`.github/scripts/consistencia-rules.sh`).