# ADR-POS-006 — Shift Closing Rejection Returns to Closing State

**Status:** Accepted  
**Date:** 2026-06-30  
**Deciders:** Architecture Team

---

## Context

When a cashier submits a shift-closing report, a supervisor reviews and approves or rejects it. The state machine in the specification does not define what happens to the shift state on rejection: should it return to `Open`, to a new `Closing` state, or be marked with a `Rejected` terminal state that requires a re-submission?

## Decision

On supervisor **rejection**, the shift returns to the **`Closing`** state with the rejection reason attached. The cashier can correct the cash count / notes and re-submit without reopening the shift for new sales.

The `Closing` → `Rejected` → `Closing` cycle can repeat until the supervisor approves.

A shift in `Closing` state:
- Does **not** accept new sales.
- Does **not** allow new cash-out movements.
- The cashier sees the rejection reason and the fields that need correction.

## Consequences

**Positive:**
- Cashier can correct counting errors without manager having to unlock the shift for transactions.
- The audit trail captures each submission attempt and rejection reason.
- Simpler state machine: no `Rejected` terminal state, no "re-open" flow.

**Negative / Watch-outs:**
- If a cashier is unable to reconcile, a manager must intervene and force-approve (separate permission: `pos.shift.force_approve`).

## Alternatives Considered

- **Rejection returns to `Open`** — rejected. Allows new sales after closing attempt, which complicates reconciliation.
- **`Rejected` is a terminal state requiring manager to unlock** — rejected. Creates unnecessary friction for simple counting errors.
