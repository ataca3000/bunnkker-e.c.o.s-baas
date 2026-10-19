# ADR-POS-007 — Exchange Atomicity via DB::transaction + Saga Compensation

**Status:** Accepted  
**Date:** 2026-06-30  
**Deciders:** Architecture Team

---

## Context

An exchange is a compound operation: (1) process a return for the original items, (2) create a new sale for the replacement items, (3) settle the price difference. If any step fails mid-way, the system must not leave the customer's account, inventory, or payment in an inconsistent state.

The challenge: the return and the new sale each publish domain events that trigger downstream side effects (Inventory, Accounting, CRM). These side effects cannot participate in the same DB transaction.

## Decision

Exchange atomicity uses a **two-layer approach**:

**Layer 1 — Synchronous DB transaction:**  
All POS-owned writes (return record, new sale record, payment difference record, exchange linking record) execute inside a single `DB::transaction()`. If any POS write fails, the entire transaction rolls back with no partial state.

**Layer 2 — Saga compensation for downstream side effects:**  
Domain events are dispatched **after** the transaction commits. If a downstream listener fails (e.g., Inventory cannot process the return movement), a compensation event (`pos.exchange.compensation_required`) is dispatched. A compensation saga handler reverses the already-applied effects and marks the exchange as `CompensationRequired` for manual resolution.

The saga compensation record stores: exchange ID, which steps succeeded, which failed, and the reversal instructions.

## Consequences

**Positive:**
- POS internal state is always consistent after the synchronous transaction.
- Downstream failures are isolated and surfaced for human resolution rather than silently corrupting data.
- The compensation saga is an audit trail of what went wrong.

**Negative / Watch-outs:**
- Compensation logic must be implemented and tested for every downstream failure scenario.
- The `CompensationRequired` state is an exception path, not the happy path — it should trigger an immediate alert to the supervisor dashboard.

## Alternatives Considered

- **Distributed saga from the start** — rejected. Adds complexity for the common case where all steps succeed.
- **Single giant DB transaction including downstream writes** — rejected. Violates module boundaries; POS cannot write to Inventory's tables directly.
- **Accept partial state on failure** — rejected. Customer trust and financial accuracy require atomicity.
