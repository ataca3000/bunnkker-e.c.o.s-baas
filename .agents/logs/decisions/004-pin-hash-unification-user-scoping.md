# ADR 004: Unificación de Credenciales (pinHash con bcrypt) y Aislamiento Multi-Tenant en Usuarios

## Estado
Aceptado / Implementado

## Contexto
En la auditoría técnica de seguridad (P4):
1. **Credenciales y PINs:** Se detectaron dos patrones divergentes en el manejo de credenciales de empleados: unos módulos usaban el campo legacy `pin` (hasheado en SHA-256 o texto plano) mientras que otros usaban `pinHash` (bcrypt cost factor 10). Los usuarios creados recientemente o migrados que dependían únicamente de `pinHash` no podían ser localizados mediante la consulta directa `where: { pin: { in: [...] } }` en `/api/auth/session`.
2. **Aislamiento Multi-Tenant en Gestión de Usuarios:**
   - En `GET /api/users`: Las consultas listaban todos los usuarios del sistema sin filtrar por `tenantId`, exponiendo cuentas de otros tenants.
   - En `POST /api/users`: No se asignaba `tenantId` explícito al nuevo usuario y la validación de colisión de PIN no estaba acotada a la sucursal actual.
   - En `PUT /api/users/[id]` y `DELETE /api/users/[id]`: No se verificaba la pertenencia del usuario al `tenantId` del superadmin/admin solicitante, lo que permitía mutaciones o eliminaciones cruzadas. Además, no se prevenía la auto-eliminación del superadmin activo.

## Decisiones de Diseño

1. **Aislamiento Multi-Tenant Estricto (`tenantId`):**
   - Se extendió `validateActiveDbUser` en `src/lib/apiAuth.ts` para extraer y retornar `tenantId` directamente de la BD SQLite/PostgreSQL.
   - `src/app/api/users/route.ts` (GET y POST) ahora aplica obligatoriamente `where: { tenantId }`.
   - `src/app/api/users/[id]/route.ts` (PUT y DELETE) verifica fehacientemente que el usuario destino pertenezca a la sucursal (`where: { id, tenantId }`), rechazando peticiones ajenas con 404/403.
   - Se bloqueó la auto-eliminación de la cuenta en sesión actual del superadmin.
   - Los administradores regulares no pueden modificar ni auto-promocionarse a `superadmin`.

2. **Unificación y Migración Automática a `pinHash` (bcrypt):**
   - En `src/app/api/auth/session/route.ts`, si no se localiza al usuario por el hash directo SHA-256 legacy, se evalúan los usuarios activos con `pinHash` mediante `bcrypt.compare` (admitiendo formatos limpios, alfanuméricos y con prefijos de estación).
   - Migración transparente y sin fricción (zero downtime): Al autenticar exitosamente, si el usuario aún carece de `pinHash` o mantiene un valor legacy en `pin`, se genera y persiste automáticamente el hash seguro bcrypt en background.
   - En `PUT /api/users/[id]`, se incorporó la actualización segura de PIN con validación de duplicidad por sucursal y hasheo simultáneo en SHA-256 (compatibilidad) y bcrypt (soberanía).

## Consecuencias
- **Positivas:**
  - Imposibilidad de fuga de cuentas de empleados o colisiones de PIN entre diferentes sucursales/tenants.
  - Autenticación robusta basada en bcrypt sin romper retrocompatibilidad ni requerir reseteo masivo de PINs para los usuarios en operación local.
  - Fail-closed total: peticiones no autorizadas o maliciosas entre sucursales se rechazan de inmediato.
- **Riesgos Mitigados:**
  - Ataques de enumeración de usuarios entre inquilinos.
  - Escalada horizontal o vertical de privilegios en `/api/users/[id]`.
