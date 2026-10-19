# EN-001 — Stale `optimizeDeps.include` entry: `use-sync-external-store/shim`

| | |
|---|---|
| **Status** | Open — for evaluation during **Platform Quality** |
| **Raised** | 2026-08-03 |
| **Origin** | Observed incidentally while diagnosing a dev-server port collision |
| **Scope** | **Outside EPIC-1 (Platform Foundation) and EPIC-2 (Platform Architecture)** |
| **Severity** | Low — cosmetic warning, no functional impact |
| **Owner** | Unassigned |

## Observation

Every Vite dev-server start prints:

```
Failed to resolve dependency: use-sync-external-store/shim, present in client 'optimizeDeps.include'
```

## Evidence

`frontend/vite.config.ts` declares the dependency for pre-bundling:

```js
optimizeDeps: {
  include: ['react', 'react-dom', 'use-sync-external-store/shim'],
},
```

Verified state of that package:

| Check | Result |
|---|---|
| Present in `frontend/node_modules/` | **No** |
| Declared in `frontend/package.json` | **No** (transitive only, if ever) |
| Last change to `vite.config.ts` | `96ba2aba`, 2026-07-16 |

So the config asks Vite to pre-bundle a module that is not installed.

## Assessment

**Not a defect, and not caused by any current work.** The dev server starts, the
application renders, and the console is clean — the message is a warning, not an
error. It was present before EPIC-1 began and appears on every start regardless
of the Platform Foundation changes.

**Likely cause:** a leftover from a React 17/18-era setup. `useSyncExternalStore`
became part of React itself in 18, and this project is on **React 19.2.7**, so
the shim is almost certainly obsolete rather than missing.

**Why it is worth clearing:** a permanent warning on every dev-server start
trains the team to ignore startup output, which is where a real problem would
eventually appear. That is the same failure mode that let 4,869 ESLint errors and
a permanently-red `i18n-guard` workflow become background noise.

## Proposed action — do not execute before Platform Quality

1. Confirm nothing imports `use-sync-external-store` (directly or transitively):
   `npm ls use-sync-external-store`
2. If unused, remove the entry from `optimizeDeps.include` in `frontend/vite.config.ts`
3. Restart the dev server and confirm the warning is gone and the app still renders

Expected diff: one line. No runtime behaviour change.

## Explicitly out of scope

Do **not** action this during EPIC-1 or EPIC-2. Per CTO direction of 2026-08-03,
`vite.config.ts` and `optimizeDeps` are frozen for the duration of those Epics.

## Related

Raised during diagnosis of a dev-server port collision (`Port 5173 is already in
use`). That collision was an operational issue — two dev servers, with
`strictPort: true` correctly refusing to fall back — and is **unrelated** to this
note beyond having surfaced it. No action required for the collision.
