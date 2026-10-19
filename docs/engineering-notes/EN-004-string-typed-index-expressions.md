# EN-004 — Three `string`-typed index expressions defeat translation key checking

| | |
|---|---|
| **Status** | Open — **Platform Quality backlog** |
| **Raised** | 2026-08-03, at EPIC-L10N-001 closure |
| **Classification** | **Application typing defect** — explicitly *not* a localization defect |
| **Severity** | Low — 3 diagnostics; no runtime impact |
| **Owner** | Unassigned — Platform Quality |

## Observation

Three translation call sites index a locale object with an expression the
compiler widens to `string`, so no key union exists to validate against:

| File | Root | Index |
|---|---|---|
| `features/logistics/distribution-planning/components/zone-detail-drawer.tsx:40` | `planning.orderStatus` | `status` |
| `features/logistics/fleet/components/fleet-unit-drawer.tsx:331` | `fleet.costType` | `type` |
| `features/marketing/intelligence/components/intelligence-filter-bar.tsx:53` | `intelligence.datePreset` | `p` |

Each produces one TS2339. They are the entire residue of EPIC-L10N-001, which
closed the other 1,242.

## Why localization cannot fix this

Every other dynamic key in the codebase resolved because its index carried a
real union — `VehicleDocumentType`, `ConflictAuthority`, `WorkflowTriggerType`
and nine others. The compiler named each type, the declaration was located, and
the members were transcribed verbatim.

These three name no type. `Object.entries()` iteration and untyped constant
arrays widen the key to `string`, so there is no enumerable member list.

Two non-solutions were rejected during EPIC-L10N-001:

- **Guessing keys** — plausible-looking entries that silently never resolve at
  runtime. This is precisely the defect class the Epic existed to eliminate.
- **A generic index signature** — clears the diagnostic while removing key
  checking for the whole object. Weakens the type system.

The defect is upstream of localization: the *source* has lost the type
information the locale file would be validated against.

## Proposed remediation

Narrow each index at its origin, then the existing key-generation tooling
resolves the rest automatically:

1. **`zone-detail-drawer.tsx`** — a local `map` object already enumerates the
   statuses (`preparing`, `pending`, `processing`, …). Declare it `as const`, or
   type `status` against `ORDER_STATUS_KEYS`, which exists.
2. **`fleet-unit-drawer.tsx`** — `type` comes from `Object.entries(costs)`.
   Give the cost breakdown an explicit interface so its keys form a union.
3. **`intelligence-filter-bar.tsx`** — `DATE_PRESETS.map((p) => …)`. Declare
   `DATE_PRESETS` `as const`.

Each is a one-line typing change in application code. After any of them,
`node scripts/l10n-missing-keys.mjs --write` generates the correct keys with no
further manual work — the compiler will name the union exactly as it did for the
other twelve.

**Expected result:** TS2339 → 0 with full type safety preserved.

## Constraints

- Application code — out of scope for EPIC-L10N-001 (CTO ruling, 2026-08-03)
- Do not add guessed localization keys
- Do not weaken typing to clear the count

## Related

- **EPIC-L10N-001** — certified complete; this is its declared residue
- **EN-002** — harness persists metrics, not diagnostics
- Tooling: `frontend/scripts/l10n-missing-keys.mjs`, `l10n-resolve-dynamic.mjs`
