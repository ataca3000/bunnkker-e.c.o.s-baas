# Aggregate Mapping

**Document:** AGGREGATE-MAPPING  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-DATA-ARCH-001  
**Parent:** ENTERPRISE-LOGICAL-DATA-ARCHITECTURE.md

---

## 1. Purpose

This document maps each of the 15 aggregate roots (from AGGREGATE-CATALOG.md) to its logical data entities. It defines which tables belong to each aggregate, which table is the aggregate root table, and how the aggregate boundary maps to the data model.

---

## 2. Aggregate → Table Mapping

### AGG-01: Company
```
Root Table:   companies
Owned Tables: branches, warehouses, channels, company_settings
              (employees are shared with HR domain but company-scoped)
Boundary:     All organizational entities reference companies.id
Note:         The company is the root of the entire tenant hierarchy
```

### AGG-02: Order
```
Root Table:   orders
Owned Tables: order_lines
Boundary:     order_lines.order_id → orders.id (FK within domain)
External Refs: orders.channel_id, orders.customer_id, orders.warehouse_id (UUID refs, no FK)
Note:         An Order is the commercial fact; fulfillment, finance, and inventory
              do not own any tables within this aggregate
```

### AGG-03: Product
```
Root Table:   products
Owned Tables: product_channel_configs (pricing per channel)
Boundary:     product_channel_configs.product_id → products.id (FK)
External Refs: products.category_id, products.unit_id, products.recipe_id (UUID refs)
Note:         Stock levels are NOT owned by Product; they belong to Inventory items
```

### AGG-04: RawMaterial
```
Root Table:   raw_materials
Owned Tables: receipt_layers, reservations, stock_movements
              inventory_items (current stock position per warehouse)
Boundary:     All owned tables reference raw_materials.id (FK within domain)
              reservations and stock_movements are polymorphic (also serve Product)
External Refs: raw_materials.category_id, raw_materials.preferred_supplier_id (UUID refs)
Note:         FIFO costing is maintained through receipt_layers ordering by received_at
```

### AGG-05: Recipe
```
Root Table:   recipes (a.k.a. bills_of_materials)
Owned Tables: recipe_lines (a.k.a. bill_of_material_lines)
Boundary:     recipe_lines.recipe_id → recipes.id (FK)
External Refs: recipes.product_id (output product), recipe_lines.raw_material_id (UUID refs)
Note:         recipe_cost is stored on recipes (calculated, not live-computed)
```

### AGG-06: Supplier (a.k.a. ProcurementSupplier)
```
Root Table:   suppliers
Owned Tables: supplier_contacts, supplier_performance_records
Boundary:     All owned tables reference suppliers.id (FK)
Note:         Supplier is a master data entity in the Procurement domain
```

### AGG-07: PurchaseOrder
```
Root Table:   purchase_orders
Owned Tables: purchase_order_lines, goods_receipts, gr_lines,
              supplier_invoices, supplier_returns, supplier_return_lines
Boundary:     purchase_order_lines.purchase_order_id → purchase_orders.id (FK)
              goods_receipts.purchase_order_id → purchase_orders.id (FK, nullable for direct GR)
External Refs: purchase_orders.supplier_id, purchase_orders.warehouse_id (UUID refs)
```

### AGG-08: Customer
```
Root Table:   customers
Owned Tables: customer_addresses, customer_consent_records
Boundary:     All owned tables reference customers.id (FK)
External Refs: customers.company_id
Note:         PII columns: name, phone, email, addresses — anonymized on GDPR request
```

### AGG-09: PreparationWave
```
Root Table:   preparation_waves
Owned Tables: wave_items (orders + items in the wave), wave_pick_lists
Boundary:     wave_items.wave_id → preparation_waves.id (FK)
External Refs: wave_items.order_id, wave_items.product_id (UUID refs)
```

### AGG-10: ShippingWave
```
Root Table:   shipping_waves
Owned Tables: shipping_wave_vehicles (assignments), allocation_records,
              prepared_products_pool, loading_sessions
Boundary:     All owned tables reference shipping_waves.id (FK)
External Refs: shipping_waves.warehouse_id, vehicle_id (UUID refs)
```

### AGG-11: Vehicle
```
Root Table:   vehicles
Owned Tables: vehicle_inventory (what is currently loaded)
Boundary:     vehicle_inventory.vehicle_id → vehicles.id (FK)
External Refs: vehicles.company_id, vehicles.driver_id (UUID refs)
Note:         vehicle_inventory is append-only (each load/unload is a new record)
```

### AGG-12: Shipment
```
Root Table:   shipments
Owned Tables: shipment_orders (M:N), delivery_attempts, packing_jobs (optional)
Boundary:     delivery_attempts.shipment_id → shipments.id (FK)
External Refs: shipments.vehicle_id, shipments.shipping_wave_id (UUID refs)
```

### AGG-13: POSSession
```
Root Table:   pos_sessions
Owned Tables: pos_sales, pos_sale_lines, pos_cash_movements
Boundary:     pos_sales.session_id → pos_sessions.id (FK)
External Refs: pos_sessions.warehouse_id, pos_sessions.cashier_id (UUID refs)
```

### AGG-14: Invoice
```
Root Table:   invoices
Owned Tables: invoice_lines, payments
Boundary:     invoice_lines.invoice_id → invoices.id (FK)
              payments.invoice_id → invoices.id (FK)
External Refs: invoices.order_id, invoices.customer_id (UUID refs)
```

### AGG-15: Campaign
```
Root Table:   campaigns
Owned Tables: campaign_segments, campaign_customers (M:N)
Boundary:     campaign_segments.campaign_id → campaigns.id (FK)
External Refs: campaigns.company_id, campaign_customers.customer_id (UUID refs)
```

---

## 3. Cross-Aggregate Data Flow

The following table shows which domain events cause cross-aggregate data updates (always via event subscription, never direct update):

| Event | Source Aggregate | Target Aggregate | Data Updated |
|---|---|---|---|
| orders.order.confirmed | Order | RawMaterial | Reservation created |
| orders.order.cancelled | Order | RawMaterial | Reservation cancelled |
| fulfillment.preparation_wave.completed | PreparationWave | RawMaterial | Reservation consumed; stock_movements created |
| procurement.goods_receipt.posted | PurchaseOrder | RawMaterial | ReceiptLayer created; stock_movements created |
| orders.order.delivered | Order | Invoice | Invoice created |
| orders.order.delivered | Order | Customer | LTV updated in CRM read model |
| finance.pos_sale.completed | POSSession | Product | Stock movement created |
