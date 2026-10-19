# COM-010D — FIFO Inventory Layer Consumption & COGS Engine

## Overview

Implements a real-time First-In-First-Out (FIFO) inventory costing engine. Every stock shipment consumes layers from the oldest receipt first, producing an immutable audit trail and computing actual COGS per order.

---

## Domain Model

### InventoryReceiptLayer

Each goods receipt creates one or more receipt layers:

| Column | Type | Notes |
|--------|------|-------|
| `received_qty` | decimal(15,4) | Original quantity received |
| `remaining_qty` | decimal(15,4) | Decremented as FIFO consumes |
| `landed_unit_cost` | decimal(15,4) | Includes freight, duties, etc. |
| `supplier_id` | uuid \| null | Null for inventory adjustments |
| `goods_receipt_id` | uuid \| null | Null for inventory adjustments |
| `goods_receipt_line_id` | uuid \| null | Null for inventory adjustments |

### InventoryLayerConsumption

Immutable audit record created for every FIFO consumption event:

| Column | Type | Notes |
|--------|------|-------|
| `inventory_item_id` | uuid | The item whose stock was consumed |
| `inventory_receipt_layer_id` | uuid | Which layer was consumed |
| `product_id` / `warehouse_id` / `company_id` | uuid | Denormalized for fast reporting |
| `order_id` / `order_line_id` | uuid \| null | Set for shipments, null for adjustments |
| `quantity` | decimal(15,4) | Units consumed from this layer |
| `unit_cost` / `total_cost` | decimal(15,4) | FIFO cost at time of consumption |
| `created_at` | timestamp | Only timestamp — immutable, no `updated_at` |

---

## FIFO Algorithm

`InventoryLayerConsumptionService::consume()`:

```
1. Load all open layers for (product_id, warehouse_id) WHERE remaining_qty > 0
   ORDER BY created_at ASC, id ASC  -- oldest first, stable tie-break
   LOCK FOR UPDATE                  -- prevent concurrent depletion race

2. Check sum(remaining_qty) >= requested quantity
   → InsufficientStockException if not

3. Walk layers oldest → newest:
   - take = min(layer.remaining_qty, remaining_needed)
   - layer.remaining_qty -= take
   - create InventoryLayerConsumption record
   - total_cost += take × layer.landed_unit_cost

4. Return ConsumptionResult { totalQuantity, totalCost, weightedCost, consumedLayers[] }
```

All operations run inside the caller's DB transaction. If FIFO fails, the entire shipment rolls back.

---

## Shipment Flow

`ShipOrderInventoryAction::execute(Order)`:

```
DB::transaction {
  guard: already shipped? → throw OrderAlreadyShippedException

  for each OrderLine:
    ShipStockAction::execute(dto)         # decrements on_hand_qty, releases reserved_qty
    layerConsumptionService.consume(...)  # FIFO, throws on insufficient
    refreshFifoCost(product_id)           # updates product.current_fifo_cost

  total_cogs   = sum of ConsumptionResult.totalCost per line
  total_revenue = order.total

  order.update {
    actual_cogs_amount   = total_cogs
    actual_margin_amount = total_revenue - total_cogs
    actual_margin_percent = (margin / revenue) × 100
    inventory_shipped_at = now()
  }
}
```

---

## FIFO Cost on Products

`product.current_fifo_cost` always reflects the cost of the **oldest open receipt layer**:

- Updated after every shipment (`refreshFifoCost()` in `ShipOrderInventoryAction`)
- Updated after every goods receipt (`CreateReceiptLayersAction`)
- Updated after inventory count approval adjustments (`ApproveCountSessionAction`)

---

## API Endpoints

### GET /inventory/layers
Returns receipt layers with filters: `product_id`, `warehouse_id`, `supplier_id`, `open_only`, `date_from`, `date_to`.

### GET /products/{product}/cost-history
Returns for a product:
- `layers`: all receipt layers (most recent first)
- `consumptions`: all consumption events
- `cost_summary`: { current_fifo_cost, average_cost, last_purchase_cost, open_layers_qty, open_layers_value }

---

## Key Value Objects

### ConsumptionResult
```php
final class ConsumptionResult {
    public readonly float $totalQuantity;
    public readonly float $totalCost;
    public readonly float $weightedCost;   // totalCost / totalQuantity
    public readonly array $consumedLayers; // list<ConsumedLayerDTO>
}
```

### ConsumedLayerDTO
```php
final class ConsumedLayerDTO {
    public readonly string $layerId;
    public readonly float  $quantity;
    public readonly float  $unitCost;
    public readonly float  $totalCost;
}
```

---

## Supplier Analytics Extensions

`GetSupplierAnalyticsQuery` now includes:

| Field | Calculation |
|-------|-------------|
| `inventory_remaining_cost` | SUM(remaining_qty × landed_unit_cost) for open layers |
| `inventory_remaining_sale_value` | SUM(remaining_qty × sale_price_snapshot) |
| `inventory_remaining_profit` | sale_value - cost |
| `inventory_remaining_margin_percent` | profit / sale_value × 100 |

---

## Tests

`tests/Feature/Inventory/InventoryLayerConsumptionTest.php` — 12 tests:

1. Single layer fully consumed
2. Multi-layer FIFO consume (spans 2 layers)
3. Exact layer depletion (remaining → 0)
4. Partial layer depletion
5. Insufficient layers → `InsufficientStockException`
6. Shipment rollback on FIFO failure (no consumption records written)
7. Consumption audit records created with correct quantities/costs
8. FIFO order respected (oldest consumed first)
9. `current_fifo_cost` updated after shipment
10. Supplier analytics reflect remaining layers after consumption
11. `actual_cogs_amount` stored on order after shipment
12. `actual_margin_amount` and `actual_margin_percent` computed correctly

---

## File Map

| Path | Purpose |
|------|---------|
| `Modules/Inventory/ReceiptLayers/Domain/Models/InventoryReceiptLayer.php` | Layer model |
| `Modules/Inventory/ReceiptLayers/Domain/Models/InventoryLayerConsumption.php` | Immutable audit model |
| `Modules/Inventory/ReceiptLayers/Domain/Contracts/InventoryLayerConsumptionRepositoryInterface.php` | Repository contract |
| `Modules/Inventory/ReceiptLayers/Infrastructure/Repositories/EloquentInventoryLayerConsumptionRepository.php` | Eloquent impl |
| `Modules/Inventory/ReceiptLayers/Application/DTO/ConsumptionResult.php` | Value object |
| `Modules/Inventory/ReceiptLayers/Application/DTO/ConsumedLayerDTO.php` | Value object |
| `Modules/Inventory/ReceiptLayers/Application/Services/InventoryLayerConsumptionService.php` | FIFO engine |
| `Modules/Commerce/Orders/Application/Actions/ShipOrderInventoryAction.php` | Calls FIFO per line |
| `Modules/Inventory/ReceiptLayers/Application/Actions/CreateReceiptLayersAction.php` | Sets current_fifo_cost |
| `Modules/Inventory/ReceiptLayers/Presentation/Http/Controllers/InventoryLayerController.php` | API endpoints |
