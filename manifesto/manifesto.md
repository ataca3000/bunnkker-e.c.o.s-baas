# Engineering Manifesto — BUNKKER E.C.O.S.

## Axioms & System Boundaries

1. **Local-First Sovereign Continuity:** No point-of-sale, warehouse, cashier, or inventory flow may ever block on external cloud availability.
2. **Deterministic Multi-Tenancy:** Data across tenants must be completely partitioned at the query level. Every API route must resolve `tenantId` from request context and scope all ORM queries.
3. **Fail-Closed Security:** Unauthenticated, ambiguous, or unverifiable requests must be rejected immediately (401/403). Never fail-open.
4. **Append-Only Auditing:** Financial and operational events (OrderEvent, AuditLog) must be immutable and append-only.
5. **No Code Pollution:** Memory documents (markdown) live separately from runtime execution.
