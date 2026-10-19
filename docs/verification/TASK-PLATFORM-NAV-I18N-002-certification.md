# TASK-PLATFORM-NAV-I18N-002 — Platform Navigation Localization Remediation

**Type:** Platform Foundation · **Status:** CERTIFIED · **Date:** 2026-08-07
**CTO approval:** 2026-08-07 · **Branch:** `develop` · **Commit:** `b3a009de`
**Backend / API / permission changes:** none.

---

## 0. How this task changed shape

**This task was issued as an implementation task and executed as a platform verification
and contract-hardening task.** The primary migration it describes had already been
completed by **TASK-PLATFORM-NAV-L10N-001** (`8e51d06f`), which removed all 171 hardcoded
navigation label values and made typed translation keys the source of truth.

The task's stated premise — that `module-navigation.ts` still contains hardcoded labels,
and that Guardian's `no-hardcoded-ui-strings` rule fails whenever the file is modified —
was measured before any code was written and found not to hold. Rather than re-perform a
migration that was already in place, the work became:

1. **Verify** the objective is genuinely met, empirically rather than by inspection.
2. **Harden** the contract by removing the one remaining escape hatch.
3. **Certify** the result as the permanent platform standard.

The CTO reviewed and approved this reading on 2026-08-07.

---

## 1. Verification of the existing state

Measured on the unmodified file, before any change:

| Measure | Result |
|---|---|
| Hardcoded labels in `module-navigation.ts` | **0** |
| ESLint on that file | **PASS (exit 0)** |
| Suppression entry for that file | **None** — pruned by L10N-001; repo total 4,833 |

**Empirical test of the failure claim.** A navigation item was added to the file and the
gates re-run:

- **ESLint: exit 0.** Adding navigation does not break the guard.
- **TypeScript rejected the item** because its key had no translation:
  `Type '"probe-item"' is not assignable to type '"dashboard" | ...'`

That second result is the task's own STEP 3 acceptance criterion — *missing translation
key = TypeScript error* — demonstrated at compile time. The probe was reverted.

---

## 2. Architecture

**Before this task.** Keys were already the source of truth and already typed against the
locale namespace. However `label?` and `railLabel?` survived on the types as optional
fields, retained for backward compatibility by L10N-001. No consumer read them.

**After this task.** Those fields are removed. The contract has no label field at all,
optional or otherwise. An unread optional field is still a second, silent way to specify
navigation text — precisely what this task exists to prevent — so it was deleted rather
than left empty. This was the single live gap against STEP 5 ("do not keep legacy fields").

### Navigation contract

```ts
type NavItemKey  = keyof (typeof enCommon)['nav']['items'];
type NavGroupKey = keyof (typeof enCommon)['nav']['groups'];

type ModuleNavLink    = { key: NavItemKey; path: string; icon: LucideIcon; isSection?: false };
type ModuleNavSection = { key: NavItemKey; isSection: true };
type ModuleNavItem    = ModuleNavLink | ModuleNavSection;
type AppModule        = { id: ModuleId; icon: LucideIcon; defaultPath: string; items: ModuleNavItem[] };
```

Display text resolves through the shared `useNavLabel` hook: `common.nav.groups` keyed by
module id, `common.nav.items` keyed by item key. `findNavItemByPath` returns a
discriminated `NavMatch`, because a module default path matches the group key space and an
item path matches the item key space — conflating them was what previously forced an
untyped dynamic index.

---

## 3. Files modified

`frontend/src/config/module-navigation.ts` — the only file changed by this task. Three type
declarations lost their legacy fields; no navigation entry, route, permission or consumer
was altered.

---

## 4. Measurements

| | Count |
|---|---|
| Groups (modules) | 18 |
| Items | 138 — 113 links, 25 section headers |
| Hardcoded labels | **0** |
| Translated keys — `nav.groups` | 24 |
| Translated keys — `nav.items` | 139 |
| Missing keys | **0** |
| EN / AR parity | identical |
| Consumers | 9 |

---

## 5. Consumers verified

`module-navigation.ts` · `use-nav-label.ts` · `app-sidebar` · `module-rail` ·
`mobile-menu` · `app-breadcrumbs` · `coming-soon-page` · `use-navigation`
(authorization) · `use-active-module`.

None reads a label field. Navigation key parameters are `NavItemKey` / `NavGroupKey`
throughout — no `string`, `any` or `unknown`.

---

## 6. Approved decisions

| Decision | Rationale |
|---|---|
| **Keep `key` as the canonical navigation identifier** | It is simultaneously the item's identity, its React key and its translation key. `translationKey` would describe one of the three roles and make the other two read as accidental. |
| **Do not rename to `translationKey`** | A 138-item and 9-consumer mechanical rename with no functional gain; the intent is already satisfied by `key: NavItemKey`. |
| **Remove `label` / `railLabel` permanently** | Done. No legacy escape hatch remains in the contract. |
| **No per-item permissions in the navigation contract** | Would be a navigation redesign and a permission change, both explicitly out of scope. |
| **Permissions stay in the existing visibility layer** | `useNavigation` / `isModuleVisible` continue to enforce module-level visibility, unchanged. |

---

## 7. Validation

| Gate | Result |
|---|---|
| Guardian pre-commit | **PASS** — PHP syntax ✓ ESLint ✓ TypeScript ✓ |
| `tsc -b` | **25 errors — baseline, unchanged** |
| ESLint | Clean on `module-navigation.ts` and all nine consumers |
| ESLint suppressions | **4,833 — unchanged**, no entry for this file |
| i18n audit — missing keys | **0** |
| i18n audit — invalid JSON | **0** |

**Prohibitions honoured:** no suppression added · no ESLint rule disabled · no typing
weakened · no navigation item removed · no module hidden · no label moved into feature
code · no Guardian bypass · no route, permission, API or backend change.

**Regression:** none. Every baseline is unchanged and the only diff is the removal of three
unread type fields.

---

## 8. Browser verification

Not performed. It requires an authenticated session, which cannot be established without
entering a password. Navigation is exercised on every screen of the global **Go Live
Certification** browser pass, where it remains scheduled alongside CRM and Logistics.

---

## 9. Certification

**TASK-PLATFORM-NAV-I18N-002 is CERTIFIED.**

Every success criterion holds:

- `module-navigation.ts` contains **zero** hardcoded UI labels.
- Every navigation label is driven by typed selector-mode i18n.
- Guardian passes **without suppression**.
- A future module **cannot** introduce a hardcoded label, and **cannot** ship with a
  missing translation — TypeScript rejects the key, as demonstrated by the probe in §1.

This is the permanent navigation standard for the platform.
