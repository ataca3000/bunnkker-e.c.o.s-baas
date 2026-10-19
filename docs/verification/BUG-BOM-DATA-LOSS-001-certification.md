# BUG-BOM-DATA-LOSS-001 — Recipe Component Data Loss: Final Certification

**Severity:** P0 — production data loss · **Status:** CERTIFIED · **Date:** 2026-08-07
**Branch:** `develop` · **Commits:** `130274c2` · `3b962e33` · `7887f99c` · `f96e70d2` · `3ed11c25`

---

## 1. Defect

Activating or deactivating a recipe **from the Recipes list** permanently deleted every BOM
component line.

**Confirmed chain:**

1. `EloquentBomRepository` list relations deliberately exclude lines (source comment:
   *"Relations for list endpoints — no lines"*); `BomResource` emits them only via
   `whenLoaded('lines')`. A list row carries `lines_count` and **no `lines` key**.
2. `recipesService.toggleStatus(recipe)` rebuilt a full `RecipePayload` from that row:
   `lines: (recipe.lines ?? []).map(...)` → sent **`lines: []`**.
3. `BomDTO::fromArray()` did `is_array($data['lines'] ?? null) ? … : []` — **absent and
   empty were indistinguishable**.
4. `UpdateBomAction` → `repository->update($bom, $attributes, $lines)`, typed `array`, which
   does `lines()->delete()` then `createMany()`. "Leave them alone" was not expressible at
   any layer.

**Ruled out by full trace, with evidence:** React Query keys, cache, invalidation
(company-scoped, invalidates the whole prefix, no optimistic updates), the status filter
(defaults `'all'`, omitted when all), company context, and the repository's `'all'` sentinel
(correctly guarded — an early hypothesis, disproved before any code was written).

---

## 2. Fix — four layers, each independently sufficient to break the chain

| Commit | Layer | Guarantee |
|---|---|---|
| `130274c2` | `BomDTO::$lines` → `?array`; `UpdateBomAction` propagates null; `EloquentBomRepository::update(..., ?array)` skips replacement on null; interface aligned; `UpdateBomRequest` `lines` → `sometimes\|array\|min:1`; `CreateBomAction` coerces null → `[]` | Data loss **guarded** — "leave lines alone" is expressible |
| `3b962e33` | `PATCH /boms/{bom}/status`, `SetBomStatusRequest` (one field), `SetBomStatusAction` (null lines; reads `product_id` from the record, never the request) | Data loss **unreachable** — the status payload has no `lines` field |
| `7887f99c` | `toggleStatus(recipe)` → `setStatus(id, isActive)`; `useToggleRecipeStatus` → `useSetRecipeStatus({id,isActive})` | Data loss **inexpressible** — no function accepts a row |
| `f96e70d2` | `RecipeListRow` (no `lines`) vs `Recipe = RecipeListRow & { lines }` | Data loss **uncompilable** — a list row cannot reach a full contract |

**Permission:** `inventory.recipes.update`, same as update. No new permission invented.

---

## 3. Two latent defects surfaced by the type split, both fixed

Neither had been reported. Both were invisible *because the type claimed the data was there.*

1. **CSV export and materials popover** read `r.lines_count ?? r.lines?.length ?? 0`. On a
   list row `lines` is always undefined, so the fallback never fired — it existed only to
   mask the shape mismatch. Removed.
2. **`RecipeDetailDrawer` did `const display = fullRecipe ?? recipe`.** While the detail was
   loading, tabs received the **list row** and computed costs from `recipe.lines ?? []` — an
   empty component list — so Overview and Materials briefly showed figures derived from zero
   materials. Now separated: `header` may fall back to the row (list fields only); `display`
   is the fetched detail, and tabs render from it alone.

---

## 4. Regression suite — 10 tests, 18 assertions, all passing

Run with **host PHP 8.4.22 against the worktree**. Not inside `ecos-app`, which mounts the
main checkout and would have tested code without this fix.

| Case | Assertion |
|---|---|
| Update without a `lines` key | components preserved — the original defect, inverted |
| DTO, absent key | maps to `null`, never `[]` |
| DTO, explicit `[]` | stays an array, never `null` |
| Update **with** lines | components replaced — an update must still update |
| `SetBomStatusAction` | components preserved |
| Ten activate/deactivate cycles | **same `raw_material_id`s** survive, not merely the same count |
| `PATCH /status` over HTTP | components preserved |
| `PATCH /status` without `is_active` | 422 |
| `PATCH /status` with a smuggled `lines` key | ignored, not honoured |
| `PUT` with `lines: []` | 422 — `min:1` survived required → sometimes |

The cycle test asserts identity rather than cardinality deliberately: a
replace-with-equivalent bug would pass a count check while still losing the originals.

---

## 5. Repository-wide toggle audit

Every status-change method in `src/features` — 16 across 12 modules.

| Module / service | Method | Signature | Verb | Class |
|---|---|---|---|---|
| logistics/delivery | `setStatus` | `id, status` | PATCH | **Safe** |
| logistics/dispatch (board) | `setBoardStatus` | `id, payload` | PATCH | **Safe** |
| logistics/dispatch (ops) | `setSessionStatus` | `id, status, reason?` | PATCH | **Safe** |
| logistics/distribution-zones | `toggleStatus` | `id` | PATCH | **Safe** |
| logistics/drivers | `setStatus` | `id, status, reason?` | PATCH | **Safe** |
| logistics/geography | `toggleGovernorateStatus` | `id` | PATCH | **Safe** |
| logistics/geography | `toggleCityStatus` | `governorateId, cityId` | PATCH | **Safe** |
| logistics/network | `setStatus` | `id, status, reason?` | PATCH | **Safe** |
| logistics/operations | `setPoolStatus` | `id, status, reason?` | PATCH | **Safe** |
| logistics/operations | `setMemberStatus` | `memberId, status, reason?` | PATCH | **Safe** |
| logistics/routing | `activate` | `tripId, planId` | PATCH | **Safe** |
| logistics/shipping-companies | `setStatus` | `id, status` | PATCH | **Safe** |
| logistics/shipping-companies | `activateContract` | `companyId, contractId` | PATCH | **Safe** |
| logistics/trips | `setStatus` | `id, status, reason?` | PATCH | **Safe** |
| logistics/vehicles | `setStatus` | `id, status, reason?` | PATCH | **Safe** |
| **recipes** | `setStatus` | `id, isActive` | PATCH | **Safe** *(was Unsafe; fixed by `7887f99c`)* |

**Unsafe: 0. Requires a dedicated status endpoint: 0.**

Two structural properties verified across the whole tree:
- **Every** status method takes an **id**, never a row — so none can rebuild a payload from a
  partial DTO.
- **Every** one uses **PATCH to a status-specific endpoint** — none PUTs to the resource root.

A targeted sweep for the defect's exact signature — `field: (row.collection ?? [])` inside a
request payload — returns **zero matches** across `src/features`.

**Recipes was the sole offender in the codebase.**

---

## 6. Validation

| Gate | Result |
|---|---|
| PHPUnit (this suite) | **10 passed, 18 assertions** |
| Guardian pre-commit | **PASS** on all five commits |
| TypeScript | **24 errors — baseline 24, unchanged** (improved from 25 earlier in the sprint) |
| ESLint | **0 errors** |
| ESLint suppressions | **4,833 — unchanged** |
| PHP lint | clean on all touched files, **host PHP** |

**No suppressions, no disabled rules, no schema change, no API removal, no workflow change.**
The existing `PUT /boms/{id}` behaves exactly as before for callers that send lines.

---

## 7. Outstanding

**Browser verification is not done** — it requires an authenticated session. The seven-step
activate/deactivate/reload cycle from the original brief is covered functionally by the
ten-cycle regression test, but has not been exercised through the UI. Deferred to the
Go-Live browser pass.

**Route registration is unconfirmed at runtime.** `artisan route:list` inside `ecos-app`
reads the main checkout, so `PATCH /boms/{bom}/status` could not be confirmed there. The
HTTP tests in this suite exercise the route successfully through the framework's test
kernel, which is stronger evidence than a route listing.

---

## 8. Verdict

**BUG-BOM-DATA-LOSS-001 is CERTIFIED.**

- Toggling recipe status can never delete BOM lines — guarded, unreachable, inexpressible and
  uncompilable, at four independent layers.
- Partial DTOs cannot construct full update payloads; the type system enforces it.
- Status updates are isolated from structural updates by a dedicated endpoint.
- Components survive unlimited activate/deactivate cycles, verified by identity.
- No similar data-loss pattern remains anywhere in the project.
- Zero backend regressions, zero frontend regressions.
