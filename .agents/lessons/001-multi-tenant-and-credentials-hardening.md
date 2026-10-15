# Lección 001: Aislamiento Multi-Tenant, Saneamiento de PINs y Fail-Closed

## Problema Detectado
- Varias rutas de API (`/api/purchases`, `/api/tickets`, `/api/users`, `/api/audit`) no verificaban `tenantId` o permitían consultas abiertas sin filtrar por la sucursal actual.
- Existían dos métodos divergentes de PIN (`pin` en texto/SHA-256 vs `pinHash` en bcrypt). Al no buscar con bcrypt en `/api/auth/session`, usuarios con solo `pinHash` no podían iniciar sesión.
- Varios scripts y endpoints capturaban errores y devolvían respuestas vacías o silenciaban excepciones (`catch { return [] }`), lo que impedía detectar fallos reales.

## Causa Raíz
Crecimiento rápido de endpoints sin un validador central de sesión atado a la base de datos y sin un estándar unificado de hashing de contraseñas.

## Solución Aplicada (N3 Protocol)
1. **Inyección Fail-Closed:** `validateActiveDbUser` extrae y valida el usuario y `tenantId` directamente de la BD local SQLite/Postgres.
2. **Consultas Estrictas:** Toda consulta y mutación (`findMany`, `create`, `update`, `delete`) incluye obligatoriamente `where: { tenantId }`.
3. **Autenticación Resiliente:** `/api/auth/session` primero busca por hash SHA-256 directo, y si no coincide, evalúa `bcrypt.compare` contra los usuarios activos. Además migra automáticamente los registros legacy al iniciar sesión.

## Regla Inviolable para el Agente
**Nunca** escribir una consulta a Prisma de tablas multi-tenant sin incluir `tenantId`.
**Nunca** silenciar errores con bloques `catch` vacíos.
