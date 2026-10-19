# Query Contracts

**Document:** QUERY-CONTRACTS  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-CONTRACT-ARCH-001  
**Parent:** ENTERPRISE-CONTRACTS.md

---

## 1. Query Contract Schema

Every query follows this structure:

```
Query Name:         [PascalCase domain + Query suffix]
Version:            v1
Owner:              [Module that owns the data]
Consumer:           [Module(s) that call this query]
Source of Truth:    [Primary store: OLTP | Read Model | Projection]
Aggregate:          [Aggregate root this query reads from]
Description:        [What business need this serves]
Input Filters:      [Typed filter fields]
Default Sort:       [Default ordering]
Pagination:         [Required | Optional | Cursor-based]
Security:           [Who can execute this query]
Performance Target: [Acceptable response time]
SLA Breach Action:  [What happens when target is missed]
Cache Policy:       [TTL if cached; invalidation trigger]
```

---

## 2. Commerce / Order Queries

### QRY-COM-001: OrderListQuery
```
Version:        v1
Owner:          Commerce
Consumer:       Fulfillment (wave builder), CRM, Finance, Reporting
Source:         OLTP (orders table with eager-loaded lines)
Aggregate:      Order (AGG-02)
Description:    Paginated list of orders with status, customer, and amount
Filters:
  status:             enum | enum[] (optional)
  channel_id:         UUID (optional)
  customer_id:        UUID (optional)
  warehouse_id:       UUID (optional)
  date_from/to:       date (optional)
  amount_min/max:     decimal (optional)
  search:             string (searches customer name, order number)
Default Sort:   created_at DESC
Pagination:     Required (page + per_page, max 200 per page)
Security:       Company-scoped; role: any commerce/ops role
Performance:    < 300ms at 10,000 orders
Cache:          5 min; invalidated by orders.order.* events
```

### QRY-COM-002: OrderDetailQuery
```
Version:        v1
Owner:          Commerce
Consumer:       Any module needing full Order + Lines + Customer
Source:         OLTP
Aggregate:      Order (AGG-02)
Description:    Full order with all lines, customer summary, timeline hook, and financials
Input:          order_id: UUID (required)
Security:       Company-scoped; returns 403 if company_id mismatch
Performance:    < 150ms
Cache:          2 min; invalidated by any orders.order.* event for this order_id
```

### QRY-COM-003: OrderTimelineQuery
```
Version:        v1
Owner:          Commerce (EPS-02 Timeline)
Consumer:       Any drawer showing Order Timeline tab
Source:         Timeline read model
Description:    Chronological activity for one Order
Input:          order_id: UUID (required), page, per_page
Default Sort:   occurred_at DESC
Performance:    < 200ms
Cache:          30 sec
```

---

## 3. Inventory Queries

### QRY-INV-001: InventoryAvailabilityQuery
```
Version:        v1
Owner:          Inventory
Consumer:       Fulfillment (wave planning), Commerce (order confirmation), Manufacturing (recipe check)
Source:         OLTP computed from ReceiptLayers + Reservations
Aggregate:      RawMaterial (AGG-04) or Product (AGG-03)
Description:    Available stock after reservations for one entity at one warehouse
Input:
  entity_type:  enum [product | raw_material] (required)
  entity_id:    UUID (required)
  warehouse_id: UUID (optional, omit for all warehouses)
Returns:
  total_on_hand:    Quantity
  total_reserved:   Quantity
  available:        Quantity (on_hand - reserved)
  receipt_layers:   [{layer_id, qty, unit_cost, received_at}] (optional detail flag)
Performance:    < 100ms per entity
Cache:          30 sec; invalidated by inventory.*.stock_* events
```

### QRY-INV-002: StockLedgerQuery
```
Version:        v1
Owner:          Inventory
Consumer:       Inventory workspace, Finance (cost audit), Reporting
Source:         OLTP (stock_movements)
Description:    Paginated stock movement history for one entity
Input:
  entity_type:      enum [product | raw_material] (required)
  entity_id:        UUID (required)
  warehouse_id:     UUID (optional)
  movement_type:    string (optional)
  date_from/to:     date (optional)
Default Sort:   occurred_at DESC
Pagination:     Required (max 500 per page)
Performance:    < 400ms
Cache:          60 sec
```

### QRY-INV-003: BulkInventoryAvailabilityQuery
```
Version:        v1
Owner:          Inventory
Consumer:       Fulfillment (wave-level planning), Manufacturing (batch recipe check)
Source:         OLTP (batch SQL)
Description:    Available stock for a list of entities — one round trip
Input:
  items:        [{entity_type, entity_id, warehouse_id}] (required, max 500)
Returns:        Map<entity_id, AvailabilityResult>
Performance:    < 300ms for 100 items; < 1s for 500 items
Cache:          30 sec per entity (component-level)
```

---

## 4. Fulfillment — Preparation Queries

### QRY-FUL-001: PreparationDashboardQuery
```
Version:        v1
Owner:          Fulfillment
Consumer:       Preparation OS dashboard
Source:         Read Model (preparation projection)
Description:    KPIs and active waves for the Preparation OS main screen
Input:
  warehouse_id:     UUID (required)
  date:             date (optional, defaults to today)
Returns:
  active_wave_count:    integer
  completed_today:      integer
  blocked_items:        integer
  avg_completion_time:  minutes
  waves:                PreparationWave[] (status, order_count, progress_pct)
Performance:    < 200ms
Cache:          15 sec; invalidated by preparation wave events
```

### QRY-FUL-002: WaveSummaryQuery
```
Version:        v1
Owner:          Fulfillment
Consumer:       Preparation OS, Loading OS
Source:         OLTP
Description:    Full wave details with order list and per-item statuses
Input:          wave_id: UUID (required), wave_type: enum [preparation | shipping]
Performance:    < 200ms
Cache:          30 sec
```

### QRY-FUL-003: PreparedProductsPoolQuery
```
Version:        v1
Owner:          Fulfillment
Consumer:       Loading OS (product allocation)
Source:         OLTP (prepared_products_pool)
Description:    Products ready in the pool, awaiting vehicle assignment
Input:
  warehouse_id:     UUID (required)
  date:             date (optional)
Returns:        [{product_id, total_prepared, total_allocated, remaining}]
Performance:    < 150ms
Cache:          15 sec
```

---

## 5. Fulfillment — Loading / Logistics Queries

### QRY-FUL-004: VehicleDashboardQuery
```
Version:        v1
Owner:          Fulfillment
Consumer:       Loading OS, Operations Command Center
Source:         Read Model (vehicle projection)
Description:    Fleet status for all vehicles available for today's shipping waves
Input:          warehouse_id: UUID (required)
Returns:
  available:        Vehicle[]
  assigned:         Vehicle[] (with wave_id)
  in_transit:       Vehicle[] (with shipment_id, estimated_return)
  under_maintenance: Vehicle[]
Performance:    < 200ms
Cache:          30 sec; invalidated by logistics.vehicle.* events
```

### QRY-FUL-005: ShipmentStatusQuery
```
Version:        v1
Owner:          Fulfillment / Logistics
Consumer:       Logistics OS, CRM (customer portal), Operations Command Center
Source:         OLTP
Description:    Current status and location of one Shipment with all delivery attempts
Input:          shipment_id: UUID (required)
Returns:        Shipment with vehicle, driver, order_ids, delivery attempts
Performance:    < 150ms
Cache:          1 min
```

---

## 6. Manufacturing Queries

### QRY-MFG-001: RecipeMaterialAvailabilityQuery
```
Version:        v1
Owner:          Manufacturing (reads Inventory via contract)
Consumer:       Manufacturing workspace, Production Planning
Source:         Inventory QRY-INV-001 (called per material)
Description:    For a recipe, show each material with available stock vs. required qty
Input:
  recipe_id:        UUID (required)
  production_qty:   Quantity (required)
  warehouse_id:     UUID (required)
Returns:        [{material_id, required_qty, available_qty, status: available|low|blocked}]
Performance:    < 500ms (aggregates multiple inventory calls)
Cache:          30 sec
```

---

## 7. Procurement Queries

### QRY-PRC-001: SupplierHealthQuery
```
Version:        v1
Owner:          Procurement
Consumer:       Supplier workspace
Source:         OLTP (computed from GRs, POs, returns, invoices)
Description:    Supplier health score and KPI breakdown
Input:          supplier_id: UUID (required)
Returns:        {score: 0-100, on_time_rate, quality_rate, return_rate, open_po_count, overdue_po_count}
Performance:    < 300ms
Cache:          5 min; invalidated by procurement.* events for this supplier
```

### QRY-PRC-002: PurchaseOrderListQuery
```
Version:        v1
Owner:          Procurement
Consumer:       Procurement workspace, Finance
Source:         OLTP
Description:    Paginated PO list with status and value
Filters:        supplier_id, status, warehouse_id, date_from/to, overdue_only
Default Sort:   expected_date ASC
Pagination:     Required
Performance:    < 300ms
```

---

## 8. CRM Queries

### QRY-CRM-001: CustomerSummaryQuery
```
Version:        v1
Owner:          CRM
Consumer:       Order detail (customer panel), Sales reporting
Source:         Read Model (customer projection)
Description:    Customer summary with order history, value, and risk indicators
Input:          customer_id: UUID (required)
Returns:        {total_orders, lifetime_value, avg_order_value, last_order_at, risk_level, tags}
Performance:    < 200ms
Cache:          5 min
```

---

## 9. Finance Queries

### QRY-FIN-001: InvoiceListQuery
```
Version:        v1
Owner:          Finance
Consumer:       Finance workspace, CRM (customer account)
Source:         OLTP
Description:    Paginated invoice list with payment status
Filters:        customer_id, status, date_from/to, overdue_only
Default Sort:   due_date ASC
Pagination:     Required
Performance:    < 300ms
Cache:          2 min
```

### QRY-FIN-002: POSSessionSummaryQuery
```
Version:        v1
Owner:          Finance
Consumer:       POS closing workflow, Finance reporting
Source:         OLTP
Description:    Session totals, sales breakdown, payment methods, and expected cash balance
Input:          session_id: UUID (required)
Returns:        {total_sales, total_by_payment_method, expected_cash, variance}
Performance:    < 200ms
Cache:          30 sec
```

---

## 10. AI Platform Queries

### QRY-AI-001: AIRecommendationsQuery
```
Version:        v1
Owner:          AI Platform
Consumer:       Any drawer AI Insights tab, Smart Toolbar, Command Center
Source:         AI read model (recommendations store)
Description:    Active recommendations for a specific business object
Input:
  object_type:      string (required)
  object_id:        UUID (required)
  status:           enum [active | dismissed | all] (default: active)
Returns:        [{recommendation_id, type, confidence, summary, action_hint, produced_at}]
Security:       Company-scoped; AIPolicy.enabled required
Performance:    < 100ms (read from store, not real-time generation)
Cache:          30 sec
```

### QRY-AI-002: KPIDashboardQuery
```
Version:        v1
Owner:          AI Platform + individual modules
Consumer:       Executive dashboard, Command Center
Source:         Read Models + Analytics projections
Description:    Aggregated KPIs across all modules for the current company
Input:          date: date (optional, defaults to today), period: enum [day|week|month|year]
Returns:        Structured KPI map by domain (orders, fulfillment, inventory, finance)
Performance:    < 500ms
Cache:          2 min
```

---

## 11. Platform Queries

### QRY-EPS-001: TimelineQuery
```
Version:        v1
Owner:          EPS-02
Consumer:       Every Detail Drawer Timeline tab
Source:         Timeline read model
Description:    Chronological timeline entries for any business object
Input:
  object_type:    string (required)
  object_id:      UUID (required)
  entry_types:    string[] (optional filter)
  page, per_page: pagination
Default Sort:   occurred_at DESC
Performance:    < 200ms
Cache:          30 sec per (object_type, object_id)
```

### QRY-EPS-002: DocumentListQuery
```
Version:        v1
Owner:          EPS-03
Consumer:       Every Detail Drawer Documents tab
Source:         OLTP (documents + relationships)
Description:    All documents attached to a business object
Input:
  object_type:    string (required)
  object_id:      UUID (required)
  category:       string (optional filter)
Performance:    < 200ms
Cache:          1 min
```

### QRY-EPS-003: NotificationInboxQuery
```
Version:        v1
Owner:          EPS-04
Consumer:       Notification Center panel
Source:         Notification read model (per-recipient)
Description:    Inbox for a specific recipient
Input:
  recipient_id:   UUID (required)
  type:           enum [all|tasks|approvals|assignments|exceptions|mentions] (optional)
  read:           boolean (optional)
  page, per_page: pagination
Default Sort:   created_at DESC
Performance:    < 150ms
Cache:          15 sec; invalidated by platform.notification.* for this recipient
```
