# Engineering Report: COM-010A-R1B — Historical UOM Snapshot & Warehouse Assignment Preparation

**Date:** 2026-06-25  
**Module:** `Modules/Purchasing/GoodsReceipts` · `Modules/Commerce/Channels` · `Modules/Commerce/Orders`  
**Status:** Complete — 25/25 tests passing (57 assertions)

---

## Objective

Two independent, non-breaking changes delivered together:

1. **UOM Snapshot** — Capture the product's unit of measure at goods receipt creation time and store it immutably on each receipt line. Ensures historical accuracy even after a product's unit is later changed.

2. **Warehouse Assignment Preparation** — Add `default_warehouse_id` to sales channels, add `assigned_warehouse_id` to orders, and automatically propagate the assignment at order import time. Architecture prep only — no allocation engine, no stock balancing, no optimization logic.

---

## Change 1 — Historical Unit of Measure Snapshot

### Why

Quantities in goods receipt lines (e.g. `9.0000`) need a unit context to be meaningful over time. If a product's UOM changes from `KG` to `G` after a receipt is posted, historical lines must still display the unit that was authoritative at receipt time. A snapshot achieves this by copying the unit data once at creation time and never updating it again.

### Schema Delta (`2026_06_25_220000`)

```
goods_receipt_lines
  + uom_id_snapshot     UUID     NULL   — product's unit.id at receipt time
  + uom_name_snapshot   VARCHAR(100) NULL — product's unit.name at receipt time
  + uom_symbol_snapshot VARCHAR(50)  NULL — product's unit.symbol at receipt time
```

No foreign key on `uom_id_snapshot` — the snapshot is a value copy, not a reference. Deleting a Unit cannot cascade into historical receipt lines.

### Capture Logic

Both `CreateGoodsReceiptAction` and `UpdateGoodsReceiptAction` now eager-load the product's unit in a single query:

```php
$products = Product::query()->with('unit')
    ->whereIn('id', $productIds)
    ->get()
    ->keyBy('id');
```

Per line:
```php
$unit = $products->get($line->product_id)?->unit;

'uom_id_snapshot'     => $unit?->id,
'uom_name_snapshot'   => $unit?->name,
'uom_symbol_snapshot' => $unit?->symbol,
```

Products without a unit assigned result in three `null` snapshot columns — not an error.

### Immutability Guarantee

The snapshot is written **only** in Create/Update actions at the moment of receipt save. Nothing in the system writes back to these three columns after that point. The `test_uom_snapshot_immutable_after_product_unit_change` test proves this by mutating the product's `unit_id` after receipt creation and asserting the snapshot remains unchanged.

### API Changes

`GoodsReceiptLineResource` now returns:
```json
{
  "uom_id_snapshot": "uuid-of-kg-unit",
  "uom_name_snapshot": "Kilogram",
  "uom_symbol_snapshot": "KG"
}
```

### Frontend Changes

**`goods-receipt.ts`** — Added three nullable fields to `GoodsReceiptLine` type.

**`goods-receipt-form-schema.ts`** — Added `uom_symbol_snapshot: z.string().nullable().optional()` to `grLineSchema`. The `toFormValues()` mapper populates it from `l.uom_symbol_snapshot ?? null`. The field is read-only and never submitted.

**`goods-receipt-lines-editor.tsx`** — In read-only mode (view page), the net quantity cell now renders:
```
9.0000 <KG>
```
The symbol appears as a muted suffix next to the number.

---

## Change 2 — Warehouse Assignment Preparation

### Why

Inventory reservations (future feature) must know *which warehouse* should fulfil a given order. Propagating the channel's default warehouse to the order at import time is the cleanest hook point: it's deterministic, requires no user interaction, and is easy to override when the allocation engine is built.

### Architecture Constraint Honoured

No allocation engine was built. No warehouse optimization. No distance calculations. No stock balancing. The two new UUID columns are pure data storage — handshake points for the future allocation module.

### Schema Deltas

**`2026_06_25_220001`** — `channels`:
```
channels
  + default_warehouse_id  UUID NULL → FK(warehouses) ON DELETE SET NULL
```

**`2026_06_25_220002`** — `orders`:
```
orders
  + assigned_warehouse_id  UUID NULL → FK(warehouses) ON DELETE SET NULL
```

Both FKs use `ON DELETE SET NULL` so deleting a warehouse does not cascade-delete channels or orders.

### Assignment Rule

In `WooCommerceOrderImporter::buildOrder()`:
```php
'assigned_warehouse_id' => $channel->default_warehouse_id,
```

This is the only place that writes `assigned_warehouse_id` during import. If the channel has no default warehouse, `assigned_warehouse_id` is `null`.

### Model Changes

**`Channel.php`** — `default_warehouse_id` added to `$fillable`, `defaultWarehouse()` BelongsTo added.

**`Order.php`** — `assigned_warehouse_id` added to `$fillable`, `assignedWarehouse()` BelongsTo added.

### Channel API

**`ChannelDTO`** — Added `default_warehouse_id: ?string` constructor parameter and `fromArray()` mapping.

**`StoreChannelRequest` / `UpdateChannelRequest`** — Added:
```php
'default_warehouse_id' => ['nullable', 'uuid', 'exists:warehouses,id']
```

**`ChannelResource`** — Returns `default_warehouse_id`.

### Frontend Changes

**`channel.ts`** — `default_warehouse_id: string | null` added to `Channel` type and `ChannelPayload`.

**`channel-form-schema.ts`** — `default_warehouse_id: z.string().nullable().optional()` added to schema, populated in `toFormValues()`, forwarded in `toPayload()`.

**`channel-form.tsx`** — Added a full-width warehouse `Combobox` field using `useWarehouseOptions` (reused from the goods receipts feature). The field is optional — leaving it empty sends `null` to the backend.

---

## Test Coverage

### Added to `GoodsReceiptTest` (2 new tests)

| Test | Assertion |
|---|---|
| `test_uom_snapshot_captured_on_line_creation` | Creates a product with a unit, runs `CreateGoodsReceiptAction`, asserts snapshot columns match unit fields |
| `test_uom_snapshot_immutable_after_product_unit_change` | Mutates product's unit after receipt creation, asserts snapshot unchanged |

### New `OrderImportWarehouseTest` (2 tests)

| Test | Assertion |
|---|---|
| `test_order_gets_assigned_warehouse_from_channel` | Channel with `default_warehouse_id` → imported order has `assigned_warehouse_id` set |
| `test_assigned_warehouse_null_when_channel_has_no_default` | Channel without default warehouse → order `assigned_warehouse_id` is null |

**Total test suite: 25 tests, 57 assertions — all passing.**

---

## ERD Delta

```
goods_receipt_lines
  + uom_id_snapshot     UUID         NULL
  + uom_name_snapshot   VARCHAR(100) NULL
  + uom_symbol_snapshot VARCHAR(50)  NULL

channels
  + default_warehouse_id UUID NULL → FK(warehouses) SET NULL

orders
  + assigned_warehouse_id UUID NULL → FK(warehouses) SET NULL
```

---

## Readiness for Future Features

| Future feature | Handshake point |
|---|---|
| Inventory reservations | `assigned_warehouse_id` on the order — consume directly |
| Warehouse allocation engine | Override `assigned_warehouse_id` after order creation |
| UOM conversion engine | `uom_id_snapshot` + `uom_symbol_snapshot` for unit-aware quantity math |
| Historical inventory analytics | `uom_symbol_snapshot` for axis labels without joining live Unit data |
