# EPIC-CRM-UI-001 — Enterprise CRM Workspace: Final Certification

**Type:** Frontend delivery certification · **Status:** CLOSED · **Date:** 2026-08-06
**Branch:** `develop` · **Commits:** `5036de6c`, `5304ca06`, `03d2b6b8`, `903069f7`, `dcff528c`
**Backend changes:** none. This EPIC consumed the certified CRM backend only.

---

## Certification Statement

> **Browser verification deferred because an authenticated session was not available. Static
> validation (TypeScript, ESLint, localization, IAM wiring, routing and architecture) completed
> successfully.**

Browser verification is recorded as a **pending Go Live verification item**, to be executed in the
single end-to-end pass across all modules during the Go Live Certification phase.

No authentication token was copied, injected, or manipulated at any point.

---

## 1. Delivered Capabilities

| Phase | Surface | Capability |
|---|---|---|
| 1 | Customers Workspace (`/crm/customers`) | `UniversalDataGrid` + `SmartToolbar`; 6 columns (code, name, type, status, phone, email); search, type/status filters, server-side pagination, archive action |
| 2 | Customer Form | Zod + react-hook-form; **separate create and update schemas** — the two endpoints accept different field sets (create: type/status/phone/email; update: profile fields) |
| 3 | Customer Details Drawer | 7 live tabs: overview, contact, addresses, notes, documents, timeline, activity |
| 4 | Analytics Tab | Intelligence-engine view: churn/health scores with bands, RFM segment, lifecycle stage, order summary, LTV and predicted LTV, tenure/recency, insights, recommendations |
| 5 | Executive Workspace (`/crm/executive`) | KPIs, growth (opening/closing/acquired/rate plus period series), retention, satisfaction, lifetime value; period selector (monthly/quarterly/annual/custom); CSV export |

**15 endpoints consumed, zero created** — 10 on `/crm/customers/*`, 5 on `/crm/executive/*`.

### Files delivered

```
frontend/src/features/crm/
  types/     crm-customer.ts, crm-executive.ts
  services/  crm-customers-service.ts, crm-executive-service.ts
  hooks/     use-crm-customers.ts, use-crm-executive.ts
  components/crm-customer-form-schema.ts, crm-customer-form.tsx,
             crm-customer-form-drawer.tsx, crm-customer-drawer.tsx,
             crm-customer-analytics-tab.tsx
  pages/     crm-customers-workspace-page.tsx, crm-executive-workspace-page.tsx
frontend/src/i18n/locales/{en,ar}/crm.json      225 keys each
frontend/src/router/{routes.ts,router.ts}       /crm/customers, /crm/executive
```

---

## 2. IAM Integration

Three permission gates, each **verified against the backend catalogue before use**. None invented.

| Permission | Backend source | Gates |
|---|---|---|
| `crm.customers.create` | `2026_09_08_100009_seed_crm_customer_permissions_table.php` | New-customer action on the workspace |
| `crm.customers.update` | same migration | Edit action inside the customer drawer |
| `crm.executive.export` | `2026_10_20_100000_seed_crm_executive_permissions_table.php` | CSV export on the executive workspace |

Gated actions are **hidden, never disabled**, per the `usePermission()` convention.

**Granted-path verification is certified statically** — the gates are wired to real permissions and
render under `can()`. **Denied-path verification remains PENDING** until a restricted (non-admin)
user is available; it must confirm each gated action is absent, not merely inert. This is carried
into the Go Live verification item below.

---

## 3. Validation Results

| Gate | Result |
|---|---|
| `tsc -b` | **28 errors — identical to the pre-EPIC baseline.** Zero introduced |
| ESLint (`src/features/crm`, `src/router`) | Clean at `--max-warnings=0` |
| i18n audit — missing translation keys | **0** |
| i18n audit — hardcoded strings in CRM | **0** (CRM appears in no offender list) |
| RTL-unsafe classes in CRM | **0** — logical properties throughout |
| Locale parity | 225 EN keys / 225 AR keys, both authored |
| Guardian pre-commit (every phase) | PHP syntax ✓ · ESLint ✓ · TypeScript ✓ |

Selector Mode (`t($ => $.key)`) is used exclusively; no dynamic-key helper was introduced.

---

## 4. Scope Boundaries — Deliberate

1. **KPI cards removed from the customers workspace.** A KPI derived from the current page is not a
   KPI. Replaced with a `meta.total` summary line, which is what the API reports.
2. **The executive workspace filters by date range only.** The endpoints accept
   `period`/`year`/`month`/`quarter` or `start`/`end`. They accept no branch, and company comes from
   the authenticated user. The page states this on screen; a branch selector that silently changed
   nothing would be worse than its absence.
3. **Retention and lifetime value omit the period from their query keys**, because their controllers
   call `forCompany()` and ignore it. Including it would refetch identical data on every filter change.
4. **No charts.** The platform has no charting library — what reads as a chart elsewhere is a lucide
   icon. The growth series renders through `UniversalDataGrid`. Adding a chart dependency is a
   platform decision, not a UI task's.

---

## 5. Backend-Dependent Tabs (3, out of scope by instruction)

Rendered as disabled tabs carrying their required contract, so the gap is visible in the product
rather than buried in a document. **No backend work is to be performed for these.**

| Tab | Blocked on |
|---|---|
| Orders | A customer-scoped orders endpoint (`GET /crm/customers/{id}/orders`) returning id, number, date, status, total |
| Loyalty | A customer→loyalty-account lookup. Loyalty is addressed by `accountId` today; the account cannot be resolved from a customer |
| Permissions | Record-level permission data per customer. Not modelled in the domain today |

---

## 6. Navigation

The CRM module remains in `HIDDEN_MODULE_IDS` (go-live scope decision TASK-GOLIVE-BLOCKERS-001,
BLOCKER-2) and **is not unhidden by this EPIC**. Both routes resolve by direct URL.

No rail entry was added. `src/config/module-navigation.ts` is frozen in `eslint-suppressions.json` at
exactly **151** hardcoded-label violations; two new sidebar labels would make 153 and correctly fail
the i18n guard. Unhiding CRM therefore requires a prior localization pass on that file.

---

## 7. Pending Go Live Verification Item

To be executed during the final Go Live Certification phase, in one end-to-end pass across all modules:

- Customer Workspace · Customer Create · Customer Edit · Customer Drawer · Timeline · Analytics ·
  Executive Workspace
- Per screen: no runtime errors · no console errors · CRUD flow · EN/AR localization · RTL/LTR ·
  desktop/tablet/mobile layouts · permission visibility · loading states · empty states · error states
- **Denied-path permission verification** with a restricted user (see §2)

---

## 8. Verdict

**EPIC-CRM-UI-001 is CLOSED** on static certification. The delivered surfaces are type-safe,
lint-clean, fully localized in English and Arabic, RTL-safe, permission-gated against real backend
permissions, and company-scoped in their React Query keys. Runtime behaviour is unverified and
carried as the Go Live item above.
