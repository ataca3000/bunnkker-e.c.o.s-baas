# Architecture Documentation — ECOS ERP

This directory is the authoritative record of software architecture for ECOS ERP: bounded-context design,
Clean Architecture layering, module boundaries, cross-cutting concerns, infrastructure topology,
and Architecture Decision Records (ADRs).

---

## Contents

### System Architecture

| Document | Description |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Development infrastructure and Docker service topology |
| [COM-009-INVENTORY-FOUNDATION.md](COM-009-INVENTORY-FOUNDATION.md) | Inventory foundation: InventoryItem, StockLedger, FIFO layers |
| [COM-010A-PURCHASING-FOUNDATION.md](COM-010A-PURCHASING-FOUNDATION.md) | Purchasing: Purchase Orders, Goods Receipts, landed cost |
| [COM-010B-ORDER-RESERVATION-LIFECYCLE.md](COM-010B-ORDER-RESERVATION-LIFECYCLE.md) | Order inventory reservation lifecycle |
| [COM-010C-SUPPLIER-ANALYTICS.md](COM-010C-SUPPLIER-ANALYTICS.md) | Supplier analytics and inventory breakdown |
| [COM-011A-INVENTORY-CONTROL-DASHBOARD.md](COM-011A-INVENTORY-CONTROL-DASHBOARD.md) | ABC classification, cycle count planner, variance analytics |

### Architecture Decision Records (ADRs)

| ADR | Title | Status |
|---|---|---|
| [ADR-001](ADR-001-Lifecycle-and-Data-Integrity.md) | Entity Lifecycle and Data Integrity | Accepted |
| [ADR-002](ADR-002-Stock-Ledger.md) | Immutable Stock Ledger | Accepted |
| [ADR-003](ADR-003-WooCommerce-Integration.md) | External Sales Channel Integration Philosophy | Accepted |
| [ADR-004](ADR-004-Inventory-Architecture.md) | Inventory Architecture | Accepted |
| [ADR-005](ADR-005-Order-Ownership-and-Lifecycle.md) | Order Ownership and Lifecycle | Accepted |
| [ADR-006](ADR-006-Inventory-Domain-Events.md) | Inventory Domain Events and Integration Decoupling | Accepted |
| [ADR-007](ADR-007-Production-Standards.md) | Production Standards | Accepted |

---

## What Is an ADR?

An Architecture Decision Record (ADR) is a short document that captures an important architectural
decision, its context, and its consequences. ADRs are written when a decision:

- Is hard or expensive to reverse.
- Affects multiple modules or teams.
- Establishes a pattern that future work must follow.
- Resolves a significant trade-off between competing approaches.

ADRs are **not** API documentation or implementation guides. They explain **why** a decision was made,
not just what was decided.

---

## Numbering Convention

```
ADR-NNN-Short-Kebab-Case-Title.md
```

- `NNN` is a zero-padded three-digit integer, incrementing from 001.
- Numbers are never reused. If a decision is superseded, the old ADR is updated to `Superseded`
  and a new ADR is created.
- Gaps in numbering are acceptable when decisions are withdrawn before ratification.

**Examples:**
```
ADR-001-Lifecycle-and-Data-Integrity.md
ADR-002-Stock-Ledger.md
ADR-005-RBAC-Permission-Model.md   ← future
```

---

## ADR Status Values

| Status | Meaning |
|---|---|
| `Proposed` | Under discussion — not yet ratified |
| `Accepted` | Ratified — all new code must comply |
| `Deprecated` | Still in force but superseded by a newer ADR |
| `Superseded by ADR-NNN` | Replaced — see new ADR for current policy |
| `Rejected` | Considered and explicitly declined |

---

## How to Add a New ADR

1. Copy this template:

```markdown
# ADR-NNN — Title

**Date:** YYYY-MM-DD
**Status:** Proposed
**Author:** [Name or Team]

---

## Context

[What is the situation that requires a decision?]

## Decision

[What is the decision?]

## Consequences

### Positive
- …

### Negative / Trade-offs
- …

## Future Considerations

[What might change this decision later?]
```

2. Assign the next sequential number.
3. Set `Status: Proposed` and open for review.
4. After CTO/Architect approval, change to `Status: Accepted`.
5. Add a row to the ADR table in this README.
6. Never delete an ADR — update its status instead.

---

## Architecture Review Process

Any change that touches the following areas **requires** an ADR review before implementation:

| Area | Trigger |
|---|---|
| New domain module | Always |
| New database table or schema change | Always |
| New external integration | Always |
| Change to authentication or authorization | Always |
| Change to queue / event architecture | When behavior changes |
| Change to data retention or deletion policy | Always |
| Change to existing FSM lifecycle | Always |
| Performance-impacting refactor | When it crosses module boundaries |

**Process:**
1. Engineer proposes the ADR (status: `Proposed`).
2. CTO/Architect reviews and approves or requests changes.
3. ADR moves to `Accepted` before any implementation begins.
4. Implementation references the ADR number in code comments where relevant.
