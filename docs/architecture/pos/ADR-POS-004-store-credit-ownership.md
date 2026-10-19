# ADR-POS-004 — Accounting Module Owns Store Credit Balance

**Status:** Accepted  
**Date:** 2026-06-30  
**Deciders:** Architecture Team

---

## Context

Store credit is issued as a payment method refund during returns and can be redeemed at checkout. Two modules claim ownership: POS (issues and redeems store credit) and Accounting (maintains the customer liability ledger). If POS maintains its own store credit balance, the two will diverge. If Accounting maintains it, POS must call Accounting synchronously during checkout — creating a coupling risk.

## Decision

**Accounting is the system of record for store credit balances.** POS never maintains its own store credit ledger.

Interaction pattern:
- **Issue store credit** (return flow): POS publishes `pos.return.completed` with `refund_method = store_credit`. Accounting consumes the event and credits the customer account.
- **Check available balance** (checkout): POS calls the `StoreCreditQueryService` contract (published by Accounting). This is a synchronous, read-only query.
- **Redeem store credit** (checkout): POS publishes `pos.sale.completed` with a `store_credit` payment line. Accounting consumes and debits the account.
- **Offline redemption**: POS uses the locally cached balance (synced at session open). Over-redemption risk is accepted and handled by Accounting reconciliation on sync.

## Consequences

**Positive:**
- Single source of truth for store credit — no divergence between POS and Accounting ledgers.
- Accounting can apply store credit across all channels (POS, eCommerce, manual).

**Negative / Watch-outs:**
- POS checkout has a soft dependency on `StoreCreditQueryService`. If Accounting is unreachable and the terminal is offline, the cached balance is used.
- The `StoreCreditQueryService` contract must be defined by the Accounting module and published as an interface POS can bind to.

## Alternatives Considered

- **POS maintains its own balance, syncs periodically** — rejected. Two ledgers, guaranteed to diverge under network partitions.
- **POS and Accounting co-own balance via DB transaction** — rejected. Violates module boundary (direct cross-module DB access).
