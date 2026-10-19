# Logical Relationship Model

**Document:** LOGICAL-RELATIONSHIP-MODEL  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-DATA-ARCH-001  
**Parent:** ENTERPRISE-LOGICAL-DATA-ARCHITECTURE.md

---

## 1. Relationship Types

| Symbol | Type | Implementation |
|---|---|---|
| `1:1` | One-to-one | FK in child table; UNIQUE constraint |
| `1:N` | One-to-many | FK in child table |
| `N:M` | Many-to-many | Join table (pivot entity) |
| `→ ref` | Cross-domain reference | UUID column only; no FK constraint |

---

## 2. Within-Domain Relationships (FK Enforced)

### Organization Domain
```
companies 1:N branches              (branches.company_id → companies.id)
companies 1:N warehouses            (warehouses.company_id → companies.id)
companies 1:N channels              (channels.company_id → companies.id)
branches 1:N warehouses             (warehouses.branch_id → branches.id, nullable)
```

### Commerce Domain
```
orders 1:N order_lines              (order_lines.order_id → orders.id)
```

### Inventory Domain
```
raw_materials 1:N receipt_layers    (receipt_layers.raw_material_id → raw_materials.id)
raw_materials 1:N inventory_items   (inventory_items.raw_material_id → raw_materials.id)
products 1:N product_channel_configs (product_channel_configs.product_id → products.id)
```

### Manufacturing Domain
```
recipes 1:N recipe_lines            (recipe_lines.recipe_id → recipes.id)
```

### Procurement Domain
```
suppliers 1:N purchase_orders       (purchase_orders.supplier_id → suppliers.id)
purchase_orders 1:N po_lines        (po_lines.purchase_order_id → purchase_orders.id)
purchase_orders 1:N goods_receipts  (goods_receipts.purchase_order_id → purchase_orders.id, nullable)
goods_receipts 1:N gr_lines         (gr_lines.goods_receipt_id → goods_receipts.id)
suppliers 1:N supplier_returns      (supplier_returns.supplier_id → suppliers.id)
supplier_returns 1:N return_lines   (return_lines.supplier_return_id → supplier_returns.id)
```

### Fulfillment Domain
```
preparation_waves 1:N wave_items    (wave_items.wave_id → preparation_waves.id)
shipping_waves 1:N wave_vehicles    (wave_vehicles.shipping_wave_id → shipping_waves.id)
shipping_waves 1:N loading_sessions (loading_sessions.shipping_wave_id → shipping_waves.id)
shipping_waves 1:N allocation_records (allocation_records.shipping_wave_id → shipping_waves.id)
shipments 1:N delivery_attempts     (delivery_attempts.shipment_id → shipments.id)
```

### Logistics Domain
```
vehicles 1:N vehicle_inventory      (vehicle_inventory.vehicle_id → vehicles.id)
```

### CRM Domain
```
customers 1:N customer_addresses    (customer_addresses.customer_id → customers.id)
campaigns N:M customers             (campaign_customers join table)
```

### Finance Domain
```
invoices 1:N invoice_lines          (invoice_lines.invoice_id → invoices.id)
invoices 1:N payments               (payments.invoice_id → invoices.id)
pos_sessions 1:N pos_sales          (pos_sales.session_id → pos_sessions.id)
pos_sales 1:N pos_sale_lines        (pos_sale_lines.pos_sale_id → pos_sales.id)
```

### Platform Domain
```
(EPS entities use polymorphic references — no FK)
business_events: object_type + object_id (polymorphic)
timeline_entries: object_type + object_id (polymorphic)
documents: object_type + object_id (polymorphic)
notifications: recipient_id + recipient_type (polymorphic)
```

---

## 3. Cross-Domain References (UUID Only, No FK)

These references cross domain boundaries. FK constraints are NOT used (coupling at DB level would violate module independence).

| Column | References | Domain Boundary |
|---|---|---|
| `orders.customer_id` | `customers.id` (CRM) | Commerce → CRM |
| `orders.channel_id` | `channels.id` (Organization) | Commerce → Organization |
| `orders.warehouse_id` | `warehouses.id` (Organization) | Commerce → Organization |
| `order_lines.product_id` | `products.id` (Inventory) | Commerce → Inventory |
| `invoices.order_id` | `orders.id` (Commerce) | Finance → Commerce |
| `invoices.customer_id` | `customers.id` (CRM) | Finance → CRM |
| `receipt_layers.purchase_order_line_id` | `po_lines.id` (Procurement) | Inventory → Procurement |
| `recipe_lines.raw_material_id` | `raw_materials.id` (Inventory) | Manufacturing → Inventory |
| `recipes.product_id` | `products.id` (Inventory) | Manufacturing → Inventory |
| `preparation_waves.warehouse_id` | `warehouses.id` (Organization) | Fulfillment → Organization |
| `wave_items.order_id` | `orders.id` (Commerce) | Fulfillment → Commerce |
| `shipments.vehicle_id` | `vehicles.id` (Logistics) | Fulfillment → Logistics |
| `pos_sessions.warehouse_id` | `warehouses.id` (Organization) | Finance → Organization |
| `pos_sessions.cashier_id` | `employees.id` (Organization) | Finance → Organization |

---

## 4. N:M Join Tables

| Relationship | Join Table | Domain Owner |
|---|---|---|
| ShippingWave ↔ Orders | `shipping_wave_orders` | Fulfillment |
| Shipment ↔ Orders | `shipment_orders` | Fulfillment |
| Campaign ↔ Customers | `campaign_customers` | CRM |
| FulfillmentProfile ↔ Channels | `profile_channel_assignments` | Fulfillment |
| FulfillmentProfile ↔ Zones | `profile_zone_assignments` | Fulfillment |
| Vehicle ↔ ShippingWave | `shipping_wave_vehicles` | Fulfillment |

---

## 5. Polymorphic Relationships

Platform entities (EPS) use polymorphic references to attach to any business object:

```
Pattern: {object_type} VARCHAR(50) + {object_id} UUID

Tables using polymorphic:
  timeline_entries.object_type / object_id
  documents.object_type / object_id
  document_relationships.object_type / object_id
  business_events.aggregate_type / aggregate_id
  notifications.entity_type / entity_id (optional, for contextual notifications)
  ai_recommendations.object_type / object_id
  reservations.entity_type / entity_id (product or raw_material)
  stock_movements.entity_type / entity_id (product or raw_material)

No FK constraint possible on polymorphic columns (by design)
Validation: object_type must be one of the known entity types (enum in application)
```
