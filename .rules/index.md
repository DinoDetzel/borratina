# index.md — Borratina Digital

Mapa de navegación del proyecto. Define las reglas maestras que rigen a los demás archivos.

## Estructura del workspace

1. **`skills/`** → **[CAPACIDADES TÉCNICAS]**
   El *cómo* construimos: stack, arquitectura, convenciones, permisos.
2. **`memories/`** → **[HISTORIAL Y PROCESOS]**
   El *qué* estamos haciendo: reglas de negocio del juego, decisiones tomadas, esquema de datos.
3. **`index.md`** → Este archivo.

## Resumen del proyecto

Digitalización de la **borratina**, un juego de azar tradicional vinculado a la quiniela.
Los vendedores cargan jugadas (números + datos del comprador) a través de una web,
y el sistema guarda todo en una base de datos para determinar ganadores cuando sale
el resultado del sorteo mensual.

## Estado actual

| Área | Estado |
|---|---|
| Reglas de negocio del juego | ✅ Definidas — se gana con **4 dentro de un extracto de 20**, orden libre y los repetidos cuentan |
| Decisiones de diseño (roles, permisos, flujos) | ✅ Cerradas — salvo anular post-sorteo y el rastro de la anulación, a definir |
| Esquema de base de datos | ✅ v3 — 12 migraciones aplicadas en `backend/db/migrations/` |
| Backend (API) | ✅ Operativo — Express + `pg`, probado end-to-end contra Postgres |
| Frontend | ✅ Operativo — React + Vite, verificado en navegador y en teléfono |
| Autenticación | ✅ JWT + middlewares de rol en el backend, sesión persistida en el front |
| Comprobantes | ✅ Código único por jugada; se imprime y se manda por WhatsApp |
| En producción | ✅ Sí, con comprobantes reales en manos de compradores |

> Que ya esté en uso **cambia qué migraciones son aceptables**: nada que
> reescriba códigos de comprobante ya emitidos. Ver [[esquema-base-datos]] →
> migración 012.

## Reglas maestras

- Toda nueva regla de negocio o decisión de producto se registra en `memories/reglas-de-negocio.md` o `memories/decisiones-de-diseno.md`, según corresponda.
- Todo cambio de stack, convención de código o arquitectura se registra en `skills/tech-stack.md`.
- El esquema de base de datos vive en `memories/esquema-base-datos.md`. Ya existen migraciones reales: la fuente de verdad ejecutable es `backend/db/migrations/`, y el `.md` documenta el porqué de cada decisión. Si cambia una, cambian los dos.
- Antes de escribir código nuevo, revisar `memories/` para no contradecir una decisión ya tomada.
- Los 4 números de una **jugada** se guardan siempre normalizados en orden ascendente, y nada inserta en `jugadas` sin pasar por `utils/numeros.js`. El **extracto del sorteo no se normaliza**: se guarda como se publicó. Son dos tratamientos distintos a propósito — ver [[esquema-base-datos]].
- La regla de quién gana vive **solo** en `backend/src/utils/ganadores.js`, en dos formas que tienen que dar siempre lo mismo: `condicionGanadora()` (SQL) y `esGanadora()` (JS). Si se toca una, se toca la otra.
- Todo lo que sea "qué día es" se resuelve en la **zona horaria del club**, no en la del servidor: `TZ_CLUB` en `config.js`, aplicada en `db.js` y dentro de `generar_codigo_jugada()`.