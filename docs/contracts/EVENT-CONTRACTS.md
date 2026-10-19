# Event Contracts

**Document:** EVENT-CONTRACTS  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-CONTRACT-ARCH-001  
**Parent:** ENTERPRISE-CONTRACTS.md

---

## 1. Event Contract Schema

Every event contract is the formal specification for a domain event. Events are immutable, versioned, and append-only.

```
Event Name:         [domain.aggregate.past_tense_verb]
Version:            v1
Producer:           [Module that emits this event]
Aggregate:          [Aggregate root from AGGREGATE-CATALOG.md]
Description:        [What business thing happened]
Trigger:            [Which command or action caused this event]
Consumers:          [Modules that subscribe to this event + what they do]
Payload Schema:     [Fields emitted in the event payload]
Correlation:        [correlation_id usage — links related events in a workflow]
Causation:          [causation_id — the event that caused this one]
Replay Safe:        [Yes | Idempotent consumers only | No]
Version History:    [Changes per version]
Retention:          [How long event is kept]
```

---

## 2. Commerce Events

### EVT-COM-001: orders.order.confirmed
```
Version:        v1
Producer:       Commerce
Aggregate:      Order (AGG-02)
Trigger:        ConfirmOrder command
Consumers:
  - Inventory:   ReserveInventory for each OrderLine
  - EPS-02:      Add timeline entry "Order confirmed"
  - EPS-04:      Notify customer (order confirmation)
  - Finance:     Pending — watch for delivery to create Invoice
Payload:
  order_id:         UUID
  order_number:     string
  customer_id:      UUID
  channel_id:       UUID
  warehouse_id:     UUID
  lines:            [{line_id, product_id, quantity, unit_price}]
  total_amount:     Money
  confirmed_at:     datetime
  confirmed_by:     UUID
Correlation:    session_id or batch_id (if bulk confirm)
Replay Safe:    Idempotent consumers only (Inventory checks existing reservation)
Retention:      7 years (financial audit)
```

### EVT-COM-002: orders.order.cancelled
```
Version:        v1
Producer:       Commerce
Aggregate:      Order (AGG-02)
Trigger:        CancelOrder command
Consumers:
  - Inventory:   ReleaseReservation for all reservations linked to this order
  - EPS-02:      Add timeline entry "Order cancelled"
  - EPS-04:      Notify customer (if policy)
Payload:
  order_id:         UUID
  reason:           string
  cancelled_at:     datetime
  cancelled_by:     UUID
  had_reservations: boolean
Replay Safe:    Yes
Retention:      7 years
```

### EVT-COM-003: orders.order.in_preparation
```
Version:        v1
Producer:       Commerce (triggered by Fulfillment event)
Aggregate:      Order (AGG-02)
Trigger:        fulfillment.preparation_wave.started (sets order → in_preparation)
Consumers:
  - EPS-04:     Notify operations team
  - EPS-02:     Timeline entry
Payload:        order_id, wave_id, started_at
Replay Safe:    Yes
```

### EVT-COM-004: orders.order.ready
```
Version:        v1
Producer:       Commerce (triggered by Fulfillment event)
Aggregate:      Order (AGG-02)
Trigger:        fulfillment.preparation_wave.completed
Consumers:
  - Fulfillment:  Order is now eligible for ShippingWave
  - EPS-04:       Notify shipping team
Payload:        order_id, wave_id, ready_at
Replay Safe:    Yes
```

### EVT-COM-005: orders.order.dispatched
```
Version:        v1
Producer:       Commerce
Aggregate:      Order (AGG-02)
Trigger:        DispatchShipment command
Consumers:
  - EPS-04:     Notify customer
  - EPS-02:     Timeline entry "Out for delivery"
  - CRM:        Update customer last_activity
Payload:        order_id, shipment_id, vehicle_id, driver_id, dispatched_at, estimated_delivery
Replay Safe:    Yes
```

### EVT-COM-006: orders.order.delivered
```
Version:        v1
Producer:       Commerce
Aggregate:      Order (AGG-02)
Trigger:        ConfirmDelivery command
Consumers:
  - Finance:      CreateInvoice
  - CRM:          Update lifetime value, increment order count
  - EPS-04:       Notify customer (delivery confirmation + invoice)
  - EPS-02:       Timeline entry
Payload:        order_id, delivered_at, delivered_by, proof_type, proof_reference
Replay Safe:    Idempotent consumers only (Finance checks existing Invoice)
Retention:      7 years
```

### EVT-COM-007: orders.order.delivery_failed
```
Version:        v1
Producer:       Commerce
Aggregate:      Order (AGG-02)
Trigger:        FailDelivery command
Consumers:
  - Fulfillment:  Create re-attempt or return to warehouse
  - EPS-04:       Notify supervisor
  - CRM:          Record delivery failure
Payload:        order_id, shipment_id, reason, attempt_number, failed_at
Replay Safe:    Yes
```

---

## 3. Inventory Events

### EVT-INV-001: inventory.raw_material.stock_reserved
```
Version:        v1
Producer:       Inventory
Aggregate:      RawMaterial (AGG-04)
Trigger:        ReserveInventory command
Consumers:
  - Fulfillment:  Confirm reservations before wave start
  - EPS-02:       Timeline entry (if reservation is large)
Payload:
  reservation_id:   UUID
  entity_type:      string
  entity_id:        UUID
  warehouse_id:     UUID
  quantity:         Quantity
  purpose_type:     string
  purpose_id:       UUID
  reserved_until:   datetime | null
Replay Safe:    Idempotent (keyed on reservation_id)
Retention:      2 years
```

### EVT-INV-002: inventory.raw_material.reservation_cancelled
```
Version:        v1
Producer:       Inventory
Aggregate:      RawMaterial (AGG-04)
Trigger:        ReleaseReservation command
Consumers:
  - EPS-02:      Timeline entry (if large reservation)
Payload:        reservation_id, entity_id, released_quantity, reason, released_at
Replay Safe:    Yes
```

### EVT-INV-003: inventory.raw_material.stock_consumed
```
Version:        v1
Producer:       Inventory
Aggregate:      RawMaterial (AGG-04)
Trigger:        ConsumeReservation command
Consumers:
  - Finance:     Cost of goods consumed (FIFO layer costs)
  - EPS-02:      Stock movement entry
Payload:        entity_id, reservation_id, consumed_quantity, warehouse_id, consumed_at, cost_layers_consumed
Replay Safe:    Idempotent (keyed on reservation_id)
```

### EVT-INV-004: inventory.raw_material.stock_added
```
Version:        v1
Producer:       Inventory
Aggregate:      RawMaterial (AGG-04)
Trigger:        PostGoodsReceipt command
Consumers:
  - Finance:      Record COGS basis
  - EPS-02:       Timeline entry "Stock received"
  - EPS-04:       Notify purchaser (if low stock alert was active)
Payload:        entity_id, warehouse_id, quantity_added, unit_cost, receipt_layer_id, source_type, source_id
Replay Safe:    Idempotent (keyed on goods_receipt_id)
Retention:      7 years (FIFO cost audit)
```

### EVT-INV-005: inventory.raw_material.stock_adjusted
```
Version:        v1
Producer:       Inventory
Aggregate:      RawMaterial (AGG-04)
Trigger:        AdjustStock command
Consumers:
  - Finance:     Inventory adjustment journal entry
  - EPS-02:      Timeline entry
Payload:        entity_id, warehouse_id, adjustment_qty, reason, adjusted_by, adjusted_at
Replay Safe:    Not replay-safe (each adjustment is unique)
Retention:      7 years
```

### EVT-INV-006: inventory.cost_layer.consumed
```
Version:        v1
Producer:       Inventory
Aggregate:      RawMaterial (AGG-04)
Trigger:        ConsumeReservation (FIFO layer depletion)
Consumers:
  - Finance:     FIFO COGS calculation per cost layer
Payload:        layer_id, entity_id, consumed_qty, layer_unit_cost, consumed_at
Replay Safe:    Idempotent (keyed on layer_id + reservation_id)
Retention:      7 years
```

---

## 4. Fulfillment Events

### EVT-FUL-001: fulfillment.preparation_wave.created
```
Version:        v1
Producer:       Fulfillment
Aggregate:      PreparationWave (AGG-09)
Consumers:
  - EPS-02:     Timeline entries for each order in wave
  - EPS-04:     Notify warehouse team
Payload:        wave_id, warehouse_id, order_ids, wave_type, created_by, created_at
Replay Safe:    Yes
```

### EVT-FUL-002: fulfillment.preparation_wave.started
```
Version:        v1
Producer:       Fulfillment
Aggregate:      PreparationWave (AGG-09)
Consumers:
  - Commerce:    Set all wave orders → in_preparation
  - EPS-04:      Notify supervisor
Payload:        wave_id, order_ids, started_by, started_at
Replay Safe:    Idempotent
```

### EVT-FUL-003: fulfillment.preparation_wave.completed
```
Version:        v1
Producer:       Fulfillment
Aggregate:      PreparationWave (AGG-09)
Consumers:
  - Inventory:  ConsumeReservation per prepared item
  - Commerce:   Set orders → ready
  - EPS-04:     Notify loading team
Payload:        wave_id, order_ids, prepared_items: [{item_id, prepared_qty}], completed_by, completed_at
Replay Safe:    Idempotent (keyed on wave_id)
```

### EVT-FUL-004: fulfillment.prepared_pool.added
```
Version:        v1
Producer:       Fulfillment
Aggregate:      PreparationWave (AGG-09)
Consumers:
  - Loading OS: Items available in pool for vehicle assignment
Payload:        product_id, quantity, wave_id, warehouse_id, added_at
Replay Safe:    Idempotent (keyed on wave_id + product_id)
```

### EVT-FUL-005: fulfillment.shipping_wave.vehicle_assigned
```
Version:        v1
Producer:       Fulfillment
Aggregate:      ShippingWave (AGG-10)
Consumers:
  - Logistics:  Vehicle.status → assigned; create LoadingSession
  - EPS-04:     Notify driver
Payload:        wave_id, vehicle_id, driver_id, order_ids, assigned_by, assigned_at
Replay Safe:    Idempotent
```

### EVT-FUL-006: fulfillment.shipping_wave.allocation_completed
```
Version:        v1
Producer:       Fulfillment
Aggregate:      ShippingWave (AGG-10)
Consumers:
  - Loading OS: Begin physical loading
Payload:        wave_id, allocations: [{order_id, vehicle_id, product_id, quantity}], allocated_at
Replay Safe:    Idempotent
```

### EVT-FUL-007: fulfillment.shipment.dispatched
```
Version:        v1
Producer:       Fulfillment
Aggregate:      Shipment (AGG-12)
Consumers:
  - Commerce:   Set orders → dispatched
  - Logistics:  Vehicle.status → in_transit
  - EPS-04:     Notify customers (live tracking)
Payload:        shipment_id, vehicle_id, driver_id, order_ids, dispatched_at, estimated_arrival
Replay Safe:    Yes
Retention:      7 years
```

### EVT-FUL-008: fulfillment.shipment.delivered
```
Version:        v1
Producer:       Fulfillment
Aggregate:      Shipment (AGG-12)
Consumers:
  - Commerce:   ConfirmDelivery → orders.order.delivered
Payload:        shipment_id, order_id, delivered_at, proof_type, proof_reference, delivered_by
Replay Safe:    Idempotent
Retention:      7 years
```

### EVT-FUL-009: fulfillment.shipment.failed
```
Version:        v1
Producer:       Fulfillment
Aggregate:      Shipment (AGG-12)
Consumers:
  - Commerce:   orders.order.delivery_failed
  - EPS-04:     Notify supervisor
Payload:        shipment_id, order_id, reason, attempt_number, failed_at
Replay Safe:    Yes
```

---

## 5. Procurement Events

### EVT-PRC-001: procurement.purchase_order.created
```
Version:        v1
Producer:       Procurement
Aggregate:      PurchaseOrder (AGG-07)
Consumers:
  - EPS-02:     Timeline entry
  - EPS-04:     Notify approver (if approval required)
Payload:        po_id, supplier_id, warehouse_id, lines, total_amount, created_by
Replay Safe:    Yes
```

### EVT-PRC-002: procurement.goods_receipt.posted
```
Version:        v1
Producer:       Procurement
Aggregate:      PurchaseOrder (AGG-07)
Consumers:
  - Inventory:  PostGoodsReceipt → stock_added per line
  - Finance:    Accounts Payable accrual
Payload:        gr_id, po_id, supplier_id, lines: [{material_id, quantity, unit_cost}], posted_by, posted_at
Replay Safe:    Idempotent (keyed on gr_id)
Retention:      7 years
```

---

## 6. Finance Events

### EVT-FIN-001: finance.invoice.issued
```
Version:        v1
Producer:       Finance
Aggregate:      Invoice (AGG-14)
Consumers:
  - CRM:        Customer balance updated
  - EPS-04:     Send invoice to customer
  - EPS-02:     Timeline entry on Order
Payload:        invoice_id, order_id, customer_id, total_amount, due_date, issued_at
Replay Safe:    Idempotent
Retention:      7 years
```

### EVT-FIN-002: finance.invoice.paid
```
Version:        v1
Producer:       Finance
Aggregate:      Invoice (AGG-14)
Consumers:
  - CRM:        Customer account settled
  - EPS-04:     Notify customer (receipt)
  - EPS-02:     Timeline entry
Payload:        invoice_id, amount_paid, payment_method, received_at, remaining_balance
Replay Safe:    Idempotent (keyed on invoice_id + payment_reference)
Retention:      7 years
```

### EVT-FIN-003: finance.pos_sale.completed
```
Version:        v1
Producer:       Finance
Aggregate:      POSSession (AGG-13)
Consumers:
  - Inventory:  Decrement stock per sold item
  - Commerce:   Create Order + set delivered
  - EPS-02:     Session activity entry
Payload:        sale_id, session_id, customer_id, lines, total, payment_method, completed_at
Replay Safe:    Idempotent (keyed on sale_id)
Retention:      7 years
```

---

## 7. Platform Events

### EVT-EPS-001: platform.ai.recommendation_generated
```
Version:        v1
Producer:       AI Platform
Consumers:
  - EPS-04:     Notify relevant user (if AIPolicy triggers notification)
  - EPS-02:     Add to object Timeline as AI entry
Payload:        recommendation_id, object_type, object_id, recommendation_type, confidence, summary, action_hint, model_id, generated_at
Replay Safe:    Idempotent
```

### EVT-EPS-002: platform.document.attached
```
Version:        v1
Producer:       EPS-03
Consumers:
  - EPS-02:     Timeline entry "Document attached"
Payload:        document_id, object_type, object_id, display_name, category, attached_by, attached_at
Replay Safe:    Yes
```

### EVT-EPS-003: platform.notification.sent
```
Version:        v1
Producer:       EPS-04
Consumers:      Audit Platform only
Payload:        notification_id, recipient_id, channel, status, sent_at
Replay Safe:    Yes
Retention:      1 year
```

---

## 8. Versioning Rules for Events

| Rule | Requirement |
|---|---|
| **Additive changes** | New optional fields may be added without a version bump |
| **Breaking changes** | Field removal, type change, or rename requires EVT-XXX v2 |
| **Dual-publish** | During migration: publish both v1 and v2 for one release cycle |
| **Consumer contract** | Consumers must declare which version they consume |
| **Schema registry** | All event schemas registered in INTEGRATION-CATALOG.md |
| **Envelope invariant** | event_id, event_type, event_version, aggregate_id, company_id, occurred_at are NEVER removed from the envelope |
