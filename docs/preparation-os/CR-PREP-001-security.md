# CR-PREP-001 — Security Design

## Authorization Model

All new endpoints enforce the existing company-scoped authorization pattern.

### Role Matrix

| Action | Operator | Supervisor | Operations Manager | Admin |
|--------|----------|-----------|-------------------|-------|
| View today's sessions | ✓ | ✓ | ✓ | ✓ |
| Start / pause session | — | ✓ | ✓ | ✓ |
| Attach order manually | — | ✓ | ✓ | ✓ |
| Detach order from session | — | ✓ | ✓ | ✓ |
| Override warehouse assignment | — | ✓ | ✓ | ✓ |
| View assignment history | ✓ | ✓ | ✓ | ✓ |
| Create / edit assignment policies | — | — | ✓ | ✓ |
| Create / edit session policies | — | — | ✓ | ✓ |
| View unassigned orders queue | — | ✓ | ✓ | ✓ |

### Gate Policies

- **Warehouse assignment override** — checked via Gate: `override-warehouse-assignment`
- **Policy CRUD** — checked via Gate: `manage-warehouse-policies`
- All gates are defined in `PreparationServiceProvider::boot()` or a dedicated `WarehouseAssignmentPolicy` (Laravel Policy class).

---

## Company Isolation

All queries are scoped by `company_id`. This is enforced at the service layer, not only the controller.

**Pattern used throughout:**
```php
WarehouseAssignmentPolicy::query()
    ->where('company_id', $companyId)
    ->where('is_active', true)
    ->get();
```

No cross-company data can leak through policy evaluation.

---

## Audit Trail

### What is Audited

Every warehouse assignment override is permanently recorded in `warehouse_assignment_overrides`:
- Who overrode (`overridden_by`)
- When (`overridden_at`)
- From which warehouse (`previous_warehouse_id`)
- To which warehouse (`new_warehouse_id`)
- Why (`reason` — required, min 10 chars)

### What is Not Audited

Automatic policy-based assignments are NOT audited row-by-row (too high volume). The assignment is visible on the order (`warehouse_assigned_at`, `warehouse_assignment_source`, `policy_id`), which is sufficient for audit purposes.

---

## Input Validation

### Warehouse Override

- `warehouse_id` — must exist in `warehouses`, must belong to same company
- `reason` — required, min 10 chars, max 500 chars
- Prevented by 403 if caller lacks the `override-warehouse-assignment` gate

### Policy Creation

- `channel_id` — if provided, must belong to same company
- `priority` — 1–9999 (enforced by CHECK constraint and validator)
- `warehouse_id` — must belong to same company
- No XSS risk — all fields are internal references (UUIDs + free-text `notes` which is escaped on output)

---

## Mass Assignment Protection

All new models use explicit `$fillable` arrays. No `$guarded = []` shortcut used anywhere.

---

## Scheduler Security

`CreateDailyPreparationSessionsCommand` runs as an artisan command from the Laravel scheduler. It:
- Does not accept user input at runtime
- Scopes all DB writes to company_id derived from the `warehouses` table
- Logs failures to the application log (not to user-visible output)
- Is idempotent — running it twice for the same day is safe
