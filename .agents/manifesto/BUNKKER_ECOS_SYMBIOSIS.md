# BUNKKER × ECOS ERP Symbiosis Manifesto

> **Guiding Principle:** Zero functional or documentation loss. High-speed sovereign execution with enterprise DDD architectural discipline.

## Core Directives

1. **Integrated Documentation Authority:**
   All architecture decisions, fulfillment state machines, and inventory reservation rules documented in `docs/` (`adr/`, `preparation-os/`, `loading-os/`, `pos/`) are authoritative for this system. Whenever implementing new operational features, adhere to these blueprints.

2. **Zero Code Pollution & Clean Boundaries:**
   - The active Next.js/React/TypeScript production runtime lives in `src/`.
   - The imported enterprise reference modules, container recipes, and backend domain contexts live in `ecos-core/`.
   - Technical blueprints, user manuals, and specifications live in `docs/`.
   - Automated quality scanning and ratchet tooling live in `engineering/`.

3. **Continuous Ratchet:**
   Every commit and feature evolution must maintain:
   - 0 TypeScript errors (`tsc --noEmit`).
   - 0 ESLint errors.
   - 100% test suite pass rate in Vitest (currently 106/106 tests).
   - Successful Build Guard verification (`npm run guard:build`).
