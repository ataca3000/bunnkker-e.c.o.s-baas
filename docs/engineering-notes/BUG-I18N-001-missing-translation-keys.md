# BUG-I18N-001 — Missing translation keys render as raw key strings

| | |
|---|---|
| **Status** | **Reclassified 2026-08-03 → promoted to EPIC-L10N-001** |
| **Supersedes** | This record is now the evidence base for the Localization Completion Program, not a standalone bug |
| **Raised** | 2026-08-03, during EPIC-1 UAT walkthrough |
| **Reported symptom** | Fleet / Shipping workspace displays `fleet.title`, `fleet.description`, `fleet.metrics.*`, `fleet.empty.*` instead of localized text |
| **Classification** | Programme-level localization gap (originally filed as a module-level defect) |
| **Scope** | **Outside EPIC-1 (Platform Foundation)** — EPIC-1 approved Engineering Complete |
| **Severity** | High — user-visible in production UI |
| **Owner** | EPIC-L10N-001 |

## EPIC-L10N-001 — Localization Completion Program

Reclassification rationale (CTO, 2026-08-03): the investigation established this
is not a single Fleet defect but a systemic gap — 1,245 missing keys across 79
files spanning multiple Logistics and Operations domains. Platform Foundation did
not introduce these defects; it exposed them by making previously untyped
namespaces type-safe.

**Objectives:**

1. Author all missing translation keys (EN canonical, AR mirrored)
2. Reduce missing-key diagnostics (TS2339) to **zero**
3. Re-measure with `frontend/scripts/measure-typecheck.mjs` after completion
4. Preserve Platform Foundation performance characteristics — see the exit
   criteria below

**Exit criteria — measured, not asserted:**

| Metric | Current | Target |
|---|---|---|
| TS2339 diagnostics | 1,245 | 0 |
| Total diagnostics | 1,602 | ≤ 357 |
| Check time | 61.78 s | no material regression |
| Instantiations | 3,021,651 | no material regression |

The performance targets exist because this programme adds translation keys. The
selected architecture is scale-independent by design, but that property must be
verified rather than assumed — see the planning note at the end of this record.

## Summary

The reported keys are **absent from the translation resources**. i18next's
documented fallback when a key cannot be resolved is to return the key itself,
which is exactly what the UI displays.

The reported Fleet symptom is one instance of a broader class affecting
**1,245 key references across 79 files**.

## Root cause

`useTranslation('logistics')` is called in
`src/features/logistics/fleet/pages/fleet-dashboard-page.tsx:57`, and the code
references `fleet.*` keys. The `logistics` namespace contains six top-level
keys and `fleet` is not among them:

```
src/i18n/locales/en/logistics.json
  → title, subtitle, governorates, cities, zones, delete
```

`grep -l '"fleet"' src/i18n/locales/en/*.json` returns no match in **any**
namespace. The keys were never authored.

## Not caused by the Platform Foundation migration

This defect **predates EPIC-1 and its runtime behaviour is unchanged by it.**

- Before the migration, `t('fleet.title')` resolved through i18next's fallback
  and rendered the literal string `fleet.title`.
- After the migration, `t($ => $.fleet.title)` resolves identically at runtime
  and renders the same literal string.

The migration changed one thing: these references are now **compile-time
errors** (TS2339) instead of silent runtime fallbacks. The Fleet page alone
produces 22 such diagnostics.

Under the previous string-key typing this class was undetectable for the 16
namespaces excluded from `CustomTypeOptions.resources` — `logistics` among
them — because those namespaces fell back to `string` and accepted any key.
Selector typing over all 51 namespaces made the defect visible.

**The bug was found by the Foundation work, not introduced by it.**

## Scale

1,245 TS2339 diagnostics across 79 files. Missing key roots by frequency:

| Missing root | References |
|---|---|
| `operations` | 163 |
| `common` | 151 |
| `dispatch` | 119 |
| `drivers` | 116 |
| `vehicles` | 113 |
| `planning` | 96 |
| `delivery` | 86 |
| **`fleet`** | **63** |
| `leave` | 44 |
| `network` | 42 |
| `workflows` | 26 |
| `shippingCompanies` | 24 |

Concentration in `logistics` sub-domains (`dispatch`, `drivers`, `vehicles`,
`planning`, `delivery`, `fleet`, `network`, `shippingCompanies` — 659
references) indicates the Logistics OS UI was built against a `logistics`
namespace that was never populated beyond geography.

## Reproduction

1. Start the dev server and open the Fleet / Shipping workspace
2. Observe raw key strings in headings, metrics, and empty states
3. Confirm the cause: `node -e "console.log(Object.keys(require('./src/i18n/locales/en/logistics.json')))"`

## Proposed remediation — not for EPIC-1

1. Author the missing keys in `src/i18n/locales/en/*.json`, and mirror the
   structure into `ar/` — Arabic must match English exactly
2. Work the list above in descending reference count; each root is an
   independent, independently shippable unit
3. Verify per root: the corresponding TS2339 diagnostics disappear
4. Run `node scripts/i18n-audit.mjs` to confirm coverage

The type checker now gives an exact, file-and-line worklist and a definitive
completion signal: **TS2339 count reaches zero**. That signal did not exist
before this defect class became type-visible.

## Related

- **ADR-037** — localization guard; this work belongs to that programme
- **EPIC-1 D-3** — 4,794 unlocalized hardcoded strings (the inverse defect:
  strings never routed through i18n at all)
- **EPIC-1 §13** — 1,602 residual diagnostics, of which 1,245 are this class

## Note for planning

EPIC-1 recommendation D-7 advised re-measuring before populating the 16
newly-typed namespaces. That advice applies here: this remediation adds
translation keys, and while the selected architecture's cost is
scale-independent by design, the assumption should be verified with
`scripts/measure-typecheck.mjs` rather than assumed.
