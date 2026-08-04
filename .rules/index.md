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
| Reglas de negocio del juego | ✅ Definidas — orden de números libre (confirmado) |
| Decisiones de diseño (roles, permisos, flujos) | ✅ Cerradas — salvo anular/restaurar post-sorteo, a definir |
| Esquema de base de datos | ✅ v2 cerrado — implementado en `backend/db/migrations/001_init.sql` |
| Backend (API) | ✅ Operativo — Express + `pg`, probado end-to-end contra Postgres |
| Frontend | ✅ Operativo — React + Vite, verificado en navegador |
| Autenticación | ✅ JWT + middlewares de rol en el backend, sesión persistida en el front |
| Comprobantes | ✅ Código único por jugada, imprimible |

## Reglas maestras

- Toda nueva regla de negocio o decisión de producto se registra en `memories/reglas-de-negocio.md` o `memories/decisiones-de-diseno.md`, según corresponda.
- Todo cambio de stack, convención de código o arquitectura se registra en `skills/tech-stack.md`.
- El esquema de base de datos vive en `memories/esquema-base-datos.md`. Ya existen migraciones reales: la fuente de verdad ejecutable es `backend/db/migrations/`, y el `.md` documenta el porqué de cada decisión. Si cambia una, cambian los dos.
- Antes de escribir código nuevo, revisar `memories/` para no contradecir una decisión ya tomada.
- Los números de una jugada se guardan **siempre normalizados en orden ascendente**. Nada inserta en `jugadas` ni carga un resultado sin pasar por `utils/numeros.js`.