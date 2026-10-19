# ADR-POS-010 — Cart State Machine: Paying → Ready Transition

**Status:** Accepted  
**Date:** 2026-06-30  
**Deciders:** Architecture Team

---

## Context

The POS specification (`05_STATE_MACHINES.md`) defines the following Cart states: `Empty`, `Active`, `Held`, `Paying`, `Completed`, `Cancelled`, `Expired`. The state machine defines a `Ready → Paying` transition (cashier initiates payment) but does not define a `Paying → Ready` transition (cashier cancels payment and returns to cart review).

This is a gap: a cashier will frequently initiate payment, then realize they need to adjust an item (remove it, change quantity, apply a coupon), and cancel back to the ready state. Without this transition, the cart is stuck in `Paying` and the cashier must cancel and rebuild it.

## Decision

Add the `Paying → Ready` transition to the Cart state machine.

**Trigger:** `CartPaymentCancelled` (cashier explicitly cancels the payment screen)  
**Guard:** No payment method has been charged. If a payment has been partially captured, the transition is blocked and a refund flow is required instead.  
**Effect:** Cart returns to `Ready` state with all items intact.

The transition is added to the `CartStateMachine` implementation in PKG-POS-005 (Cart domain).

## Consequences

**Positive:**
- Natural cashier workflow: can back out of payment screen without losing the cart.
- Eliminates a dead-end state that would force cart abandonment.

**Negative / Watch-outs:**
- If a split payment has been partially captured, the guard must be enforced strictly. A partial capture makes `Paying → Ready` invalid; the cashier must complete or void the captured portion first.
- The `CartPaymentCancelled` event must record whether any gateway calls were made, so the guard can evaluate accurately.

## Alternatives Considered

- **Keep spec as-is (no back-transition)** — rejected. Creates a dead UX state that forces cart cancellation.
- **Automatic back-transition on timeout** — rejected. A timeout-based transition could interrupt a slow payment terminal authorization, voiding a valid in-progress payment.
