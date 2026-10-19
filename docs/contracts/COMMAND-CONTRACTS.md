# Command Contracts

**Document:** COMMAND-CONTRACTS  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-CONTRACT-ARCH-001  
**Parent:** ENTERPRISE-CONTRACTS.md

---

## 1. Command Contract Schema

Every command follows this structure:

```
Command Name:       [PascalCase verb + noun]
Version:            v1
Owner:              [Module name]
Aggregate:          [Aggregate root from AGGREGATE-CATALOG.md]
Actor:              [Who can issue this command]
Preconditions:      [State requirements that must be true before the command]
Input Fields:       [Typed payload fields]
Validation Rules:   [Field-level and business-level validation]
Result:             [What the command returns on success]
Events Produced:    [Domain events emitted on success]
Policies Consumed:  [Policies evaluated during execution]
Idempotency:        [Idempotency key; safe to replay?]
Failure Modes:      [Named exceptions that may be raised]
```

---

## 2. Commerce Commands

### CMD-COM-001: ConfirmOrder
```
Version:        v1
Owner:          Commerce
Aggregate:      Order (AGG-02)
Actor:          User (commerce role), System (auto-confirm policy)
Preconditions:  Order.status = draft; at least 1 OrderLine; Customer assigned
Input:
  order_id:         UUID (required)
  confirmed_by:     UUID (actor ID, required)
  confirmation_note: string (optional)
Validation:     order_id must reference an existing Order in draft status
Result:         Order entity with status = confirmed
Events:         orders.order.confirmed
Policies:       none (confirmation is unconditional)
Idempotency:    Safe — re-confirming an already-confirmed Order is a no-op
Failures:       OrderNotFoundException, OrderNotInDraftException
```

### CMD-COM-002: CancelOrder
```
Version:        v1
Owner:          Commerce
Aggregate:      Order (AGG-02)
Actor:          User (manager role), System (expiry policy)
Preconditions:  Order.status not in [delivered, cancelled]
Input:
  order_id:         UUID (required)
  reason:           string (required)
  cancelled_by:     UUID (required)
Validation:     reason must not be empty
Result:         Order entity with status = cancelled
Events:         orders.order.cancelled
Policies:       FulfillmentPolicy (can_cancel_in_transit)
Idempotency:    Safe — re-cancelling is a no-op
Failures:       OrderNotFoundException, CannotCancelDeliveredOrderException, CannotCancelInTransitOrderException
```

### CMD-COM-003: HoldOrder
```
Version:        v1
Owner:          Commerce
Aggregate:      Order (AGG-02)
Actor:          User (supervisor role)
Preconditions:  Order.status in [confirmed, reserved, in_preparation]
Input:
  order_id:     UUID (required)
  reason:       string (required)
  held_by:      UUID (required)
Result:         Order entity with status = on_hold
Events:         orders.order.on_hold
Policies:       none
Idempotency:    Safe
Failures:       OrderNotFoundException, InvalidOrderTransitionException
```

### CMD-COM-004: UnholdOrder
```
Version:        v1
Owner:          Commerce
Aggregate:      Order (AGG-02)
Actor:          User (supervisor role)
Preconditions:  Order.status = on_hold
Input:
  order_id:     UUID (required)
  unheld_by:    UUID (required)
Result:         Order entity with status = (previous state before hold)
Events:         orders.order.unheld
Policies:       none
Idempotency:    Safe
Failures:       OrderNotFoundException, OrderNotOnHoldException
```

---

## 3. Inventory Commands

### CMD-INV-001: ReserveInventory
```
Version:        v1
Owner:          Inventory
Aggregate:      RawMaterial (AGG-04) or Product (AGG-03)
Actor:          System (triggered by orders.order.confirmed event)
Preconditions:  Entity exists; quantity > 0
Input:
  entity_type:      enum [product | raw_material] (required)
  entity_id:        UUID (required)
  quantity:         Quantity (required)
  purpose_type:     enum [order | production_job] (required)
  purpose_id:       UUID (required)
  warehouse_id:     UUID (required)
  reserved_until:   datetime (optional, per ReservationPolicy)
Validation:     Available stock >= quantity (unless InventoryPolicy.allow_negative_reservation)
Result:         Reservation entity with confirmed status
Events:         inventory.raw_material.stock_reserved (or product variant)
Policies:       InventoryPolicy (allow_negative_reservation, reservation_expiry_hours)
Idempotency:    Keyed on (entity_id, purpose_type, purpose_id) — re-sending creates a no-op if reservation exists
Failures:       InsufficientStockForReservationException, EntityNotFoundException
```

### CMD-INV-002: ReleaseReservation
```
Version:        v1
Owner:          Inventory
Aggregate:      RawMaterial (AGG-04) or Product (AGG-03)
Actor:          System (triggered by orders.order.cancelled)
Preconditions:  Reservation.status in [pending, confirmed]
Input:
  reservation_id:   UUID (required)
  released_by:      UUID (required)
  reason:           string (optional)
Result:         Reservation entity with status = cancelled
Events:         inventory.raw_material.reservation_cancelled
Policies:       none
Idempotency:    Safe
Failures:       ReservationNotFoundException, ReservationAlreadyConsumedOrCancelledException
```

### CMD-INV-003: ConsumeReservation
```
Version:        v1
Owner:          Inventory
Aggregate:      RawMaterial (AGG-04)
Actor:          System (triggered by fulfillment.preparation_wave.completed)
Preconditions:  Reservation.status = confirmed; ReceiptLayers available
Input:
  reservation_id:   UUID (required)
  consumed_quantity: Quantity (required, must be <= reserved)
  consumed_by:      UUID (required)
Validation:     consumed_quantity <= reservation.quantity
Result:         Updated ReceiptLayers + StockMovement
Events:         inventory.raw_material.stock_consumed, inventory.cost_layer.consumed
Policies:       InventoryPolicy (FIFO consumption order)
Idempotency:    Keyed on reservation_id — safe to replay
Failures:       ReservationNotFoundException, StockOverConsumptionException
```

### CMD-INV-004: AdjustStock
```
Version:        v1
Owner:          Inventory
Aggregate:      RawMaterial (AGG-04)
Actor:          User (inventory manager role)
Preconditions:  Entity exists; requires approval if > threshold
Input:
  entity_id:        UUID (required)
  warehouse_id:     UUID (required)
  adjustment_qty:   Quantity (positive = add, negative = remove)
  reason:           enum [cycle_count | damage | expired | correction] (required)
  adjusted_by:      UUID (required)
Result:         Updated InventoryItem + StockMovement
Events:         inventory.raw_material.stock_adjusted
Policies:       ApprovalPolicy (large_adjustment_threshold), InventoryPolicy
Idempotency:    Not idempotent — each adjustment is a new fact
Failures:       EntityNotFoundException, AdjustmentRequiresApprovalException
```

---

## 4. Fulfillment — Preparation Commands

### CMD-FUL-001: CreatePreparationWave
```
Version:        v1
Owner:          Fulfillment
Aggregate:      PreparationWave (AGG-09)
Actor:          User (operations supervisor), System (AI suggestion)
Preconditions:  Orders are confirmed + reserved; Warehouse selected
Input:
  warehouse_id:     UUID (required)
  order_ids:        UUID[] (required, min 1)
  wave_type:        enum [standard | priority | express | bulk | route_based] (required)
  notes:            string (optional)
  created_by:       UUID (required)
Validation:     All orders must be in reserved status; orders must belong to same warehouse
Result:         PreparationWave entity with status = draft
Events:         fulfillment.preparation_wave.created
Policies:       FulfillmentPolicy (max_wave_size, allowed_wave_types)
Idempotency:    Not idempotent — always creates a new wave
Failures:       OrderNotReservedException, WaveSizeExceededException
```

### CMD-FUL-002: StartPreparation
```
Version:        v1
Owner:          Fulfillment
Aggregate:      PreparationWave (AGG-09)
Actor:          User (warehouse operator)
Preconditions:  Wave.status = planned; all reservations confirmed
Input:
  wave_id:          UUID (required)
  started_by:       UUID (required)
Validation:     All WaveItems have confirmed reservations
Result:         PreparationWave with status = in_progress
Events:         fulfillment.preparation_wave.started, orders.order.in_preparation (per order)
Policies:       none
Idempotency:    Safe
Failures:       WaveNotFoundException, WaveNotPlannedException, ReservationNotConfirmedException
```

### CMD-FUL-003: CompletePreparation
```
Version:        v1
Owner:          Fulfillment
Aggregate:      PreparationWave (AGG-09)
Actor:          User (warehouse operator)
Preconditions:  Wave.status = in_progress; no blocked items (or policy allows)
Input:
  wave_id:          UUID (required)
  completed_by:     UUID (required)
  prepared_items:   [{item_id, prepared_qty}] (required)
Validation:     prepared_qty <= reserved_qty per item (unless ManufacturingPolicy.allow_overprepare)
Result:         PreparedProductsPool entries created; Wave status = completed
Events:         fulfillment.preparation_wave.completed, fulfillment.prepared_pool.added (per item), orders.order.ready
Policies:       ManufacturingPolicy (allow_overprepare), FulfillmentPolicy (allow_partial_wave_completion)
Idempotency:    Keyed on wave_id — safe to replay if wave already completed
Failures:       WaveHasBlockedItemsException, PreparedExceedsReservedQuantityException
```

---

## 5. Fulfillment — Loading Commands

### CMD-FUL-004: CreateShippingWave
```
Version:        v1
Owner:          Fulfillment
Aggregate:      ShippingWave (AGG-10)
Actor:          User (operations manager), System
Preconditions:  Orders are ready (prepared); vehicles available
Input:
  warehouse_id:     UUID (required)
  order_ids:        UUID[] (required)
  created_by:       UUID (required)
Result:         ShippingWave with status = draft
Events:         fulfillment.shipping_wave.created
Policies:       FulfillmentPolicy
Idempotency:    Not idempotent
Failures:       OrderNotReadyException
```

### CMD-FUL-005: AssignVehicle
```
Version:        v1
Owner:          Fulfillment
Aggregate:      ShippingWave (AGG-10) + Vehicle (AGG-11)
Actor:          User (operations supervisor), Vehicle Planning Engine
Preconditions:  Vehicle.status = available; ShippingWave.status in [draft, planned]
Input:
  shipping_wave_id: UUID (required)
  vehicle_id:       UUID (required)
  driver_id:        UUID (required)
  order_ids:        UUID[] (orders assigned to this vehicle)
  assigned_by:      UUID (required)
Validation:     Vehicle capacity must accommodate assigned orders' weight + volume
Result:         Vehicle.status = assigned; ShippingWave.allocation updated
Events:         fulfillment.shipping_wave.vehicle_assigned, logistics.vehicle.assigned
Policies:       VehiclePolicy (capacity, max_orders_per_vehicle)
Idempotency:    Keyed on (wave_id, vehicle_id) — safe to replay
Failures:       VehicleNotAvailableException, VehicleCapacityExceededException
```

### CMD-FUL-006: AllocateProducts
```
Version:        v1
Owner:          Fulfillment
Aggregate:      ShippingWave (AGG-10)
Actor:          System (Product Allocation Engine)
Preconditions:  All vehicles assigned; PreparedProductsPool has required products
Input:
  shipping_wave_id: UUID (required)
  allocations:      [{order_id, vehicle_id, product_id, quantity}] (required)
  allocated_by:     UUID (required)
Validation:     Total allocated per product = total prepared per product
Result:         AllocationRecords created; ShippingWave status → loaded (after all vehicles loaded)
Events:         fulfillment.shipping_wave.allocation_completed
Policies:       AllocationPolicy (split_order_rules, allocation_priority)
Idempotency:    Keyed on shipping_wave_id
Failures:       ProductNotInPoolException, AllocationQuantityMismatchException
```

### CMD-FUL-007: LoadVehicle
```
Version:        v1
Owner:          Fulfillment
Aggregate:      ShippingWave (AGG-10) + Vehicle (AGG-11)
Actor:          User (warehouse loader)
Preconditions:  LoadingSession open; Vehicle.status = assigned
Input:
  loading_session_id: UUID (required)
  vehicle_id:         UUID (required)
  loaded_items:       [{product_id, order_id, quantity}] (required)
  loaded_by:          UUID (required)
Validation:     loaded quantities must match allocated quantities (unless VehiclePolicy exception)
Result:         VehicleInventory updated; LoadingSession updated
Events:         logistics.vehicle.loaded
Policies:       VehiclePolicy
Idempotency:    Not idempotent — scanned loading items
Failures:       LoadingSessionNotOpenException, AllocationMismatchException
```

### CMD-FUL-008: DispatchShipment
```
Version:        v1
Owner:          Fulfillment
Aggregate:      Shipment (AGG-12)
Actor:          User (operations supervisor)
Preconditions:  All FulfillmentProfile required stages complete; Shipment.status = created
Input:
  shipment_id:      UUID (required)
  dispatched_by:    UUID (required)
  estimated_arrival: datetime (optional)
Validation:     All required stages (preparation, packing if profile requires) must be completed
Result:         Shipment.status = in_transit; Vehicle.status = in_transit
Events:         fulfillment.shipment.dispatched, orders.order.dispatched (per order), logistics.vehicle.dispatched
Policies:       FulfillmentPolicy (required_stages per profile)
Idempotency:    Safe
Failures:       RequiredFulfillmentStageIncompleteException, ShipmentAlreadyDispatchedException
```

### CMD-FUL-009: ConfirmDelivery
```
Version:        v1
Owner:          Fulfillment
Aggregate:      Shipment (AGG-12)
Actor:          User (driver), System (signature capture)
Preconditions:  Shipment.status = in_transit
Input:
  shipment_id:      UUID (required)
  order_id:         UUID (required)
  delivered_by:     UUID (driver ID, required)
  delivered_at:     datetime (required)
  proof_type:       enum [signature | photo | pin | none] (required)
  proof_reference:  string (optional, document ref)
Result:         Order.status = delivered; VehicleInventory decremented
Events:         fulfillment.shipment.delivered, orders.order.delivered, logistics.delivery_confirmed
Policies:       DeliveryPolicy (proof_required, partial_delivery_rules)
Idempotency:    Keyed on (shipment_id, order_id)
Failures:       ShipmentNotInTransitException, ProofRequiredException
```

### CMD-FUL-010: FailDelivery
```
Version:        v1
Owner:          Fulfillment
Aggregate:      Shipment (AGG-12)
Actor:          User (driver)
Preconditions:  Shipment.status = in_transit
Input:
  shipment_id:      UUID (required)
  order_id:         UUID (required)
  reason:           enum [customer_absent | wrong_address | refused | damaged] (required)
  notes:            string (optional)
  failed_by:        UUID (driver ID, required)
Result:         DeliveryAttempt recorded; re-attempt or return triggered
Events:         fulfillment.shipment.failed, orders.order.delivery_failed
Policies:       DeliveryPolicy (max_attempts, reattempt_window)
Idempotency:    Keyed on (shipment_id, order_id, attempt_number)
Failures:       ShipmentNotInTransitException
```

---

## 6. Procurement Commands

### CMD-PRC-001: CreatePurchaseOrder
```
Version:        v1
Owner:          Procurement
Aggregate:      PurchaseOrder (AGG-07)
Actor:          User (procurement officer)
Preconditions:  Supplier.status = active
Input:
  supplier_id:      UUID (required)
  warehouse_id:     UUID (required)
  lines:            [{material_id, unit_id, quantity, unit_price}] (required)
  expected_date:    date (required)
  notes:            string (optional)
  created_by:       UUID (required)
Validation:     All materials exist; quantities > 0; unit prices > 0
Result:         PurchaseOrder entity with status = draft
Events:         procurement.purchase_order.created
Policies:       ApprovalPolicy (po_approval_threshold — determines if approval required before submission)
Idempotency:    Not idempotent
Failures:       SupplierSuspendedException, MaterialNotFoundException
```

### CMD-PRC-002: PostGoodsReceipt
```
Version:        v1
Owner:          Procurement
Aggregate:      PurchaseOrder (AGG-07)
Actor:          User (warehouse receiver)
Preconditions:  PO.status in [confirmed, partially_received]; GR.status = confirmed
Input:
  goods_receipt_id: UUID (required)
  posted_by:        UUID (required)
Validation:     All GR lines have quantities; quantities do not exceed PO line quantities (unless policy)
Result:         ReceiptLayers created; StockMovements recorded; PO status updated
Events:         procurement.goods_receipt.posted, procurement.purchase_order.goods_received, inventory.raw_material.stock_added
Policies:       InventoryPolicy (allow_over_receipt)
Idempotency:    Keyed on goods_receipt_id — safe to replay
Failures:       GRNotConfirmedException, ReceiptExceedsOrderedQuantityException
```

---

## 7. Finance Commands

### CMD-FIN-001: CreateInvoice
```
Version:        v1
Owner:          Finance
Aggregate:      Invoice (AGG-14)
Actor:          System (triggered by orders.order.delivered)
Preconditions:  Order.status = delivered; no existing Invoice for this order
Input:
  order_id:         UUID (required)
  customer_id:      UUID (required)
  lines:            [{product_id, description, quantity, unit_price, tax_rate}] (required)
  issued_by:        UUID (required)
  due_date:         date (required)
Validation:     Total = sum of lines; lines must reference delivered order lines
Result:         Invoice entity with status = issued
Events:         finance.invoice.issued
Policies:       none (invoice creation follows delivery)
Idempotency:    Keyed on order_id — one invoice per order by default
Failures:       OrderNotDeliveredException, InvoiceAlreadyExistsException
```

### CMD-FIN-002: RecordPayment
```
Version:        v1
Owner:          Finance
Aggregate:      Invoice (AGG-14)
Actor:          User (cashier, accountant), System (payment gateway webhook)
Preconditions:  Invoice.status in [issued, partially_paid, overdue]
Input:
  invoice_id:       UUID (required)
  amount:           Money (required)
  payment_method:   enum [cash | card | bank_transfer | cheque | digital] (required)
  payment_reference: string (optional)
  received_by:      UUID (required)
  received_at:      datetime (required)
Validation:     amount > 0; amount + paid_to_date <= invoice total
Result:         Payment recorded; Invoice.status updated
Events:         finance.invoice.payment_received, finance.invoice.paid (if fully paid)
Policies:       none
Idempotency:    Keyed on payment_reference (if provided)
Failures:       InvoiceNotFoundException, PaymentExceedsInvoiceException
```

### CMD-FIN-003: OpenPOSSession
```
Version:        v1
Owner:          Finance
Aggregate:      POSSession (AGG-13)
Actor:          User (cashier)
Preconditions:  No active session at same warehouse (unless POSPolicy.allow_multiple_sessions)
Input:
  warehouse_id:     UUID (required)
  cashier_id:       UUID (required)
  opening_float:    Money (required)
  register_id:      string (optional)
Validation:     opening_float >= 0
Result:         POSSession entity with status = open
Events:         finance.pos_session.opened
Policies:       POSPolicy (allow_multiple_sessions_per_warehouse)
Idempotency:    Not idempotent
Failures:       ActiveSessionAlreadyOpenException
```

### CMD-FIN-004: CompletePOSSale
```
Version:        v1
Owner:          Finance
Aggregate:      POSSession (AGG-13)
Actor:          User (cashier)
Preconditions:  Session.status = open; all items have stock
Input:
  session_id:       UUID (required)
  customer_id:      UUID (optional)
  lines:            [{product_id, quantity, unit_price, discount_pct}] (required)
  payment_method:   enum (required)
  payment_amount:   Money (required)
  cashier_id:       UUID (required)
Validation:     payment_amount >= total; stock available for all items
Result:         POSSale created; Order created; Invoice created; Inventory decremented
Events:         finance.pos_sale.completed, inventory.product.stock_consumed, orders.order.delivered
Policies:       InventoryPolicy, ApprovalPolicy (discount approval threshold)
Idempotency:    Keyed on (session_id + client_generated_sale_ref)
Failures:       SessionNotOpenException, InsufficientStockException, DiscountApprovalRequiredException
```

---

## 8. AI Platform Commands

### CMD-AI-001: GenerateRecommendation
```
Version:        v1
Owner:          AI Platform
Aggregate:      AIRecommendation (Platform)
Actor:          System (event-triggered), Scheduled job
Preconditions:  AIPolicy.enabled for this recommendation type
Input:
  object_type:      string (required — e.g. order, wave, vehicle)
  object_id:        UUID (required)
  recommendation_type: string (required — e.g. sla_risk, wave_merge, cost_anomaly)
  triggered_by:     enum [event | scheduled | manual] (required)
  context:          JSONB (optional — additional context for the model)
Validation:     AIPolicy must be active for this company + recommendation_type
Result:         AIRecommendation entity with status = active
Events:         platform.ai.recommendation_generated
Policies:       AIPolicy (enabled_models, confidence_threshold, output_policy)
Idempotency:    Keyed on (object_type, object_id, recommendation_type, context_hash) — 15-min window
Failures:       AIModelNotEnabledException, ConfidenceBelowThresholdException
```

---

## 9. Platform (EPS) Commands

### CMD-EPS-001: AttachDocument
```
Version:        v1
Owner:          EPS (Document Platform)
Aggregate:      Any (polymorphic)
Actor:          User
Preconditions:  File upload complete; virus scan passed
Input:
  object_type:      string (required)
  object_id:        UUID (required)
  file_reference:   string (storage path, required)
  display_name:     string (required)
  category:         string (required)
  tags:             string[] (optional)
  attached_by:      UUID (required)
Result:         Document entity with status = clean
Events:         platform.document.attached
Policies:       DocumentPolicy (allowed_categories, max_size, scan_required)
Idempotency:    Not idempotent — each upload is a new document
Failures:       DocumentQuarantinedException, CategoryNotAllowedException
```

### CMD-EPS-002: SendNotification
```
Version:        v1
Owner:          EPS (Notification Platform)
Aggregate:      Notification (Platform)
Actor:          System (event-triggered via NotificationPolicy)
Preconditions:  NotificationPolicy active for this notification_type
Input:
  notification_type: string (required)
  recipient_ids:    UUID[] (required)
  channels:         enum[] [in_app | email | sms | whatsapp | push] (required)
  payload:          JSONB (required)
  priority:         enum [critical | high | normal | low] (required)
  policy_id:        UUID (required)
Result:         Notification entity created; delivery jobs queued
Events:         platform.notification.sent (per delivery)
Policies:       NotificationPolicy (rate_limits, working_hours, channel_preferences)
Idempotency:    Keyed on (notification_type, source_event_id)
Failures:       NotificationPolicyNotFoundException, RecipientNotFoundException
```
