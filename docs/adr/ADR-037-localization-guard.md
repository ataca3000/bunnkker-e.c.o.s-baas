# ADR-037: Localization Guard — No Hardcoded UI Strings

- **Status:** Accepted
- **Date:** 2026-07-29
- **Tasks:** TASK-I18N-002 (Arabic localization completion), TASK-I18N-GUARD-001 (guard)
- **Builds on:** TASK-I18N-ARCH-001 (lazy Vite backend, 50 namespaces, RTL CSS)

## Context

TASK-I18N-ARCH-001 delivered the localization *infrastructure*: a Vite glob backend
with lazy per-namespace chunks, `useFormatter`, RTL stylesheet support, and 48
namespaces (now 50). Coverage was strong in the hook/JSON layer — every English key
had an Arabic counterpart.

The infrastructure did not prevent drift. A measured audit found **4,755 hardcoded
English strings across 366 `.tsx` files** — every one of them in a page, drawer,
table cell, or inline component that bypassed the translation system entirely.
Separately, **65 navigation entries** (the whole Logistics, HR, and Engineering
sidebars plus 14 module headers) rendered English in Arabic mode because
`t('nav.items.X', { defaultValue: english })` silently fell back.

The pattern is consistent: conventions written in documentation get followed where
someone remembers them, and ignored everywhere else. Nothing mechanically enforced
the rule, so coverage decayed with every new feature.

## Decision

### 1. Localization correctness is enforced by the build, not by convention

Two custom ESLint rules ship as a local flat-config plugin (`eslint-rules/`):

- **`ecos-i18n/no-hardcoded-ui-strings`** — flags JSX text nodes, user-facing
  props (`placeholder`, `label`, `title`, `description`, `emptyMessage`, `tooltip`,
  `alt`, `aria-label`…), `toast.*()` arguments, and copy-bearing object literal
  keys when they contain English prose.
- **`ecos-i18n/no-arabic-literals`** — flags inline Arabic anywhere in `.ts`/`.tsx`.
  Inline Arabic is worse than inline English: it renders Arabic even when the user
  selects English, silently breaking language switching.

Both are `error`. `npm run lint` fails, so CI fails.

### 2. Exceptions are encoded, not argued

The rule carries explicit allow-lists rather than relying on reviewer judgement:

| Category | Examples |
|---|---|
| Brand / product / third-party names | WooCommerce, Shopify, Meta, Claude, GitHub, Docker |
| Technical identifiers & API names | API, SKU, UUID, JSON, FIFO, SHA-256, webhook |
| Programming terms | git, commit, branch, diff, ESLint, PHPStan |
| Non-linguistic content | URLs, emails, phone masks, CSS tokens, camelCase, CONSTANTS |

Anything already inside `t()` or `<Trans>` is exempt by construction. A per-file
escape hatch exists for genuine one-offs and requires a written reason:

```
// eslint-disable-next-line ecos-i18n/no-hardcoded-ui-strings -- <reason>
```

### 3. Coverage is a measured number, not an opinion

`scripts/i18n-audit.mjs` is the single source of truth. It reports translated
string count, missing keys, orphan keys, invalid JSON, RTL-unsafe physical Tailwind
classes, and a coverage percentage — and exits non-zero when any hard failure
remains. Available as `npm run lint:i18n`, with `npm run verify` chaining
lint → typecheck → audit.

### 4. Arabic plural forms are not orphans

Arabic has six plural categories (`zero`, `one`, `two`, `few`, `many`, `other`) to
English's two. Keys ending `_zero`/`_two`/`_few`/`_many` legitimately exist only in
the Arabic locale. The audit excludes them from orphan detection. Deleting them to
"balance" the locales would break pluralization — this bit us once and is now
encoded in the tooling.

### 5. Navigation labels are fallbacks, not source strings

`module-navigation.ts` keeps English `label` values as `defaultValue` fallbacks.
They are intentional and must not be removed; the translated text lives in
`common.json` under `nav.items.*` / `nav.groups.*`. Because `defaultValue` hides a
missing key instead of surfacing it, the audit checks nav keys explicitly.

## Consequences

**Positive:** coverage cannot silently regress; exceptions are reviewable data
rather than case-by-case debate; a single command produces the audit numbers;
new namespaces need no config change (the glob backend auto-discovers them).

**Negative:** the rule is heuristic and will occasionally flag a genuine
non-UI string — mitigated by the allow-list options and the documented escape
hatch. Enabling it on a codebase with existing violations requires the backlog to
be cleared first, or the rule staged per-directory.

## Alternatives Considered

1. **`i18next-parser` / extraction-only tooling** — extracts keys but does not
   *prevent* new hardcoded strings. Complementary, not a substitute.
2. **`eslint-plugin-i18next`'s `no-literal-string`** — closest off-the-shelf
   option, but its allow-listing is not expressive enough for our brand/technical
   vocabulary and it does not cover inline Arabic. A local rule is ~200 lines and
   fits the exception model exactly.
3. **Review-time checklist** — this is what already existed implicitly, and it
   produced 4,755 violations. Rejected.

## Compliance

- `npm run lint` — must pass (guard rules are `error`)
- `npm run lint:i18n` — must exit 0
- `.github/workflows/i18n-guard.yml` — runs both on every PR touching `frontend/**`
