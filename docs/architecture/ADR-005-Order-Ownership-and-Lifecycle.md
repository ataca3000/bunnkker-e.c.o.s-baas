# ADR-005 — Order Ownership and Lifecycle

**Date:** 2026-06-26
**Status:** Accepted
**Author:** ECOS Architecture Team

---

## Context

ECOS ERP supports order origination from multiple sales channels. WooCommerce is the first supported
channel. Future channels will include point-of-sale systems, marketplaces, mobile applications,
direct REST API clients, and manual ERP entry.

Each channel has its own notion of order state. WooCommerce uses statuses such as `pending`,
`processing`, `on-hold`, `completed`, `cancelled`, and `refunded`. A POS system may use different
terminology. A marketplace may expose yet another status model.

Without an explicit ownership policy, two problems emerge:

1. **Status fragmentation:** An order could theoretically be "completed" in WooCommerce, "processing"
   in the ERP, and "pending" on a marketplace simultaneously — with no single authority to resolve the
   conflict.
2. **Workflow coupling:** If the ERP defers to channel statuses to drive operational decisions
   (reservation, fulfilment, shipment), it becomes permanently coupled to the data model of that
   channel. Adding a second channel requires duplicating the coupling.

This ADR resolves both problems by establishing a single, unambiguous owner of the order lifecycle:
the ERP.

---

## Decision

### 1. The ERP Owns the Order Lifecycle After Acceptance

A **sales channel** is responsible for:

- Presenting the product catalogue to the customer.
- Accepting the customer's selection and payment details.
- Submitting the resulting order to the ERP.
- Displaying status updates to the customer.

A **sales channel is not responsible for** and has no authority over:

- Inventory reservation.
- Warehouse allocation.
- Picking, packing, or shipping.
- Order completion.
- Cancellation after ERP acceptance.
- Returns or refunds (future).

The moment an order is accepted into the ERP — regardless of the channel it arrived from — the ERP
assumes **full and exclusive ownership** of all operational states. The channel becomes a display
surface for status updates that the ERP pushes outward.

This principle applies to every channel, present and future, without exception.

### 2. Two Phases of an Order's Life

An order exists in two distinct phases:

**Phase 1 — Origination (Channel is the authority)**

The channel is the source. The order does not yet exist in the ERP. The customer is interacting with
the channel. Payment intent is established. The channel submits the order to the ERP.

**Phase 2 — Operational Execution (ERP is the authority)**

The ERP has accepted and recorded the order. From this point forward, the ERP drives every state
transition. The channel receives status updates as an observer, not as a decision-maker.

There is no Phase 1.5. The handover is atomic: the order is either in Phase 1 (channel-owned) or
Phase 2 (ERP-owned). Once accepted by the ERP, the order does not return to Phase 1.

### 3. Operational Responsibilities

#### Sales Channel — Origination Only

| Responsibility | Channel |
|---|---|
| Customer checkout experience | ✓ Owner |
| Payment initiation and gateway interaction | ✓ Owner |
| Order submission to ERP | ✓ Owner |
| Customer-facing status display | ✓ Owner (read-only; ERP is the source) |
| Inventory reservation | ✗ |
| Warehouse allocation | ✗ |
| Picking, packing, shipping | ✗ |
| Cancellation (after ERP acceptance) | ✗ |
| Returns processing | ✗ |

#### ERP — Operational Execution

| Responsibility | ERP |
|---|---|
| Order validation on receipt | ✓ Owner |
| Inventory availability check | ✓ Owner |
| Inventory reservation | ✓ Owner |
| Warehouse allocation | ✓ Owner |
| Picking and packing workflow | ✓ Owner (future) |
| Shipment dispatch | ✓ Owner |
| Order completion | ✓ Owner |
| Cancellation | ✓ Owner |
| Returns and refunds | ✓ Owner (future) |
| Status push to originating channel | ✓ Owner |

### 4. Synchronisation Direction

Order-related data flows in two directions, each with a single authority:

```
INBOUND — Order Creation

  Sales Channel
       │
       │  (order submitted: customer, items, totals, shipping)
       ▼
     ERP
       │
       │  (validate, reserve, record)
       ▼
  ERP owns lifecycle
```

```
OUTBOUND — Status Updates

     ERP
       │
       │  (status changed: confirmed, shipped, cancelled, …)
       ▼
  Sales Channel
       │
       │  (display to customer)
       ▼
  Customer
```

The inbound direction carries order **creation** only. After creation, all operational state flows
**outward** from the ERP to the channel. The channel does not push operational updates back.

### 5. Order Status Model

The ERP maintains its own internal order status vocabulary. This vocabulary is driven by business
operations — reservation, fulfilment, shipment — not by channel capabilities or limitations.

External channels have their own status vocabulary. The relationship between the two is a
**translation**, not an equivalence.

Conceptual illustration (not a final specification):

| ERP Internal Status | Conceptual Meaning | WooCommerce Representation |
|---|---|---|
| `pending` | Received, not yet validated | `pending` |
| `confirmed` | Validated, reservation in progress | `processing` |
| `reserved` | Inventory reserved, awaiting pick | `processing` |
| `picking` | In warehouse, being picked | `processing` |
| `shipped` | Dispatched to customer | `completed` |
| `cancelled` | Terminated before fulfilment | `cancelled` |

Several ERP internal statuses may map to a single channel status. The ERP's richer status model
is not constrained by what any channel can represent.

The ERP domain model **must never** use channel status values as first-class ERP states. Channel
statuses are integration concerns, not domain concepts.

> **Note:** The internal order status FSM — including the specific states, transitions, and
> guard conditions — is defined in a dedicated future ADR. The examples above are conceptual
> only and do not constitute the final state machine.

### 6. Handling Inbound Status Events from Channels After ERP Acceptance

Once the ERP owns the order lifecycle, a channel may still send status events — for example,
a WooCommerce webhook reporting that a payment was refunded, or a marketplace reporting that a
customer cancelled. These are **integration events**, not commands.

The ERP must not automatically replace its operational state in response to these events.

Permitted responses to inbound status events after ERP acceptance:

- **Log the event** in the synchronisation audit log for visibility and future reconciliation.
- **Raise an alert or notification** to an operator for manual review.
- **Ignore the event** if it is not actionable in the current implementation.

**Prohibited response:**

- Automatically overwriting the ERP's operational status with a channel-reported value.

The reason for this restriction: an ERP that accepts status overrides from channels loses the
single-source-of-truth property. A payment refund event, for example, might legitimately require
ERP action — but the nature of that action (partial reversal, return workflow, manual review) is
a business decision that must be made by an operator or a formal ERP workflow, not by an automatic
status copy.

The specific handling of each inbound status event type will be defined in the future
**Returns and Refunds Workflow ADR**.

### 7. Future Channels

Every sales channel that is connected to ECOS ERP in the future follows the same architecture
described in this ADR without modification:

- The channel is responsible for origination.
- The ERP is responsible for operational execution.
- Status flows outbound from ERP to channel after acceptance.
- Inbound status events after acceptance are logged, not acted upon automatically.

WooCommerce is the first implementation of this pattern. It is not a special case. The same rules
apply to a POS terminal, an Amazon marketplace integration, a mobile application, a B2B API client,
or any other order source.

Adding a new channel must not require changes to the ERP's core order domain. The channel adapter
translates between the channel's data format and the ERP's internal model; the ERP's order domain
remains unchanged.

---

## Consequences

### Positive

- **Single source of truth:** Every operational state — reservation, shipment, cancellation — exists
  in exactly one place. There is no reconciliation problem because there is no competing authority.
- **Consistent fulfilment:** The warehouse always works from ERP-owned data. A warehouse operator
  never needs to consult a sales channel to determine what to pick or ship.
- **Simplified multi-channel support:** Adding a second, third, or tenth channel does not change
  the order domain. Each channel connects to the same ERP lifecycle through a translation layer.
- **Reduced synchronisation conflicts:** Because the ERP does not accept status overrides, there is
  no conflict resolution problem for operational states.
- **Independent ERP workflow:** The ERP can introduce new internal states (e.g., `picking`,
  `packed`, `in_transit`) without needing those states to exist in any channel's data model.
- **Scalability:** The ERP's order processing pipeline scales independently of channel API limits.
  A slow channel API does not block internal order processing.

### Negative / Trade-offs

- **Operator intervention required for inbound status events:** When a channel reports a status
  change (refund, cancellation), an operator may need to manually review and act. This is correct
  behaviour — it prevents silent data corruption — but it adds process overhead until the
  Returns/Refunds workflow is formalised.
- **Channel status lag:** Because status flows outbound asynchronously, a channel's customer-facing
  status may lag slightly behind the ERP's internal state. This is acceptable for the target use case.
- **Mapping maintenance:** Each new channel requires a status translation mapping. As the ERP's
  internal status model evolves, all channel mappings must be kept in sync.
- **Channel cancellation friction:** A customer cancelling an order through a channel cannot
  instantly cancel it in the ERP. The channel event is logged; an operator or future automated
  workflow performs the ERP-side cancellation. This requires a defined SLA for cancellation response.

---

## Future Considerations

The following operational areas referenced in this ADR are intentionally not defined here. Each
will be the subject of a dedicated future ADR:

- **Inventory Reservation and Allocation Strategy** — when stock is reserved after order acceptance,
  which warehouse is selected, how conflicts between concurrent orders are resolved, and what happens
  when reservation fails. *(Referenced in ADR-004, Section 4.)*

- **Warehouse Allocation** — rules for selecting which physical warehouse fulfils a given order line,
  including multi-warehouse partial fulfilment and proximity-based routing.

- **Shipment Workflow** — how physical dispatch is recorded, how the ERP updates the order to
  `shipped`, what carrier or tracking data is captured, and how the customer is notified.

- **Returns and Refunds Workflow** — how inbound channel refund and return events are processed,
  how the ERP initiates stock adjustments, and how COGS reversals are recorded.

- **Internal Order Status FSM** — the complete finite state machine for order lifecycle, including
  all permitted states, allowed transitions, guard conditions, and terminal states.
