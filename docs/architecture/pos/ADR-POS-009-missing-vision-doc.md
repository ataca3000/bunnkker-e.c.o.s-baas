# ADR-POS-009 — Proceeding Without 01_PRODUCT_VISION.md

**Status:** Accepted  
**Date:** 2026-06-30  
**Deciders:** Architecture Team

---

## Context

The POS specification README (`00_README.md`) listed 22 documents numbered `00` through `22`. Document `01_PRODUCT_VISION.md` was absent from the delivery. All other 21 documents were received and reviewed.

## Decision

**Proceed with implementation without `01_PRODUCT_VISION.md`.** The missing document is assessed to contain strategic vision content (target personas, competitive positioning, long-term roadmap). This content is useful for alignment but is not a prerequisite for technical implementation.

Evidence that implementation can proceed:
- `02_BUSINESS_SCOPE.md` defines in-scope and out-of-scope features.
- `21_ACCEPTANCE_CRITERIA.md` defines measurable success conditions.
- `22_IMPLEMENTATION_TASK.md` defines the implementation task in detail.
- All domain models, state machines, business rules, and integration contracts are fully specified.

If `01_PRODUCT_VISION.md` is provided later and reveals scope changes, this ADR is superseded and affected packages will be re-evaluated.

## Consequences

**Positive:**
- Implementation can begin without blocking on a missing document.

**Negative / Watch-outs:**
- Unknown persona-specific requirements may surface during user testing and require backfill work.
- Long-term roadmap context is missing; architecture decisions should err toward extensibility.

## Alternatives Considered

- **Block on the missing document** — rejected. All technical inputs are available; blocking adds no value.
