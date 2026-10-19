# ADR-POS-005 — Held Cart Expiry Policy

**Status:** Accepted  
**Date:** 2026-06-30  
**Deciders:** Architecture Team

---

## Context

A cashier can "hold" a cart to serve another customer. The held cart must eventually expire to free any soft-reserved inventory and avoid stale carts accumulating indefinitely. The specification is silent on the default expiry duration and whether it is configurable per terminal or globally.

## Decision

Held cart expiry is **globally configurable** via `pos.cart.held_expiry_hours` (default: **8 hours**).

Rationale for 8-hour default:
- Covers a full retail shift without forcing premature expiry.
- Allows a customer to return the same day and resume their cart.
- Short enough to avoid inventory being held past close of business.

When a cart expires:
1. Cart status transitions to `Expired`.
2. Any soft-reserved inventory reservations are released.
3. The cashier sees a notification if they attempt to resume the cart.

A scheduled job (`ExpireHeldCartsJob`) checks every 15 minutes and expires eligible carts.

Per-terminal overrides are **not supported** in this version. All terminals in the same environment share the global configuration.

## Consequences

**Positive:**
- Simple to reason about: one configurable duration, one scheduled job.
- Zero dead inventory reservations after each business day.

**Negative / Watch-outs:**
- A customer returning after 8 hours must rebuild their cart. This is an acceptable UX trade-off.
- Very high-volume environments may want sub-hour expiry; adjust via `POS_HELD_CART_EXPIRY_HOURS` env variable.

## Alternatives Considered

- **No expiry** — rejected. Inventory reservations accumulate indefinitely.
- **1-hour default** — rejected. Too aggressive for typical browse-hold-return patterns in retail.
