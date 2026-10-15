# Capa de Aprendizaje y Patrones Validados

Este directorio registra los patrones técnicos validados y las penalizaciones de lógica aprendidas en el proyecto para evitar ciclos de prueba y error.

## Patrones Validados (Rewards)
- **Local-First SQLite WAL:** En LAN local, la base de datos SQLite con modo WAL y `synchronous=NORMAL` soporta alto tráfico concurrente sin bloqueos de lectura.
- **Fail-Closed Session:** `validateActiveDbUser` con extracción obligatoria de `tenantId`.
- **Integer Cents:** Operaciones financieras en centavos enteros (`toCents` / `fromCents`).

## Penalizaciones de Lógica (Penalties)
- ❌ **Prohibido:** Crear consultas sin `where: { tenantId }` en endpoints multi-tenant.
- ❌ **Prohibido:** Ocultar o silenciar errores con bloques `catch (e) { return [] }` sin log ni rethrow.
- ❌ **Prohibido:** Colocar pantallas o botones de test en la interfaz de usuario del cliente final.
- ❌ **Prohibido:** Confiar en float nativo para balances o arqueos de caja.
