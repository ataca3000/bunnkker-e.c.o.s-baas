# Procedural Guide: API Contract Enforcement

Every API route under `src/app/api/**` must implement:

1. **Authentication & Authorization:**
   - Public/Read: `validateApiSession(req)`
   - Mutation/Sensitive: `await requireActiveRole(req, [...allowedRoles])`
2. **Tenant Isolation:**
   - `const tenantId = getTenantId(req)`
   - Every Prisma query MUST include `where: { tenantId, ... }`
   - Every Prisma insert MUST include `data: { tenantId, ... }`
3. **Fail-Closed & Sanitized Responses:**
   - Never leak Prisma or SQL engine internal exceptions to the client.
   - Return `{ success: true, data }` or `{ success: false, error: 'Mensaje sanitizado' }`.
