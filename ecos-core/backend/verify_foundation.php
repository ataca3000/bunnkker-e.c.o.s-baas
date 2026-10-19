<?php

declare(strict_types=1);

/**
 * TASK-INV-CRITICAL-FOUNDATION-001 — Direct Verification Script (no-faker edition)
 *
 * Uses existing production records + raw DB inserts inside rolled-back transactions.
 * Run inside Docker: php verify_foundation.php
 * No PHPUnit, no faker required.
 */
define('LARAVEL_START', microtime(true));
require_once __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Modules\Inventory\InventoryItems\Domain\Contracts\InventoryItemRepositoryInterface;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;
use Modules\Inventory\InventoryItems\Domain\Models\StockLedgerEntry;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Inventory\ReceiptLayers\Application\Services\InventoryLayerConsumptionService;
use Modules\Inventory\ReceiptLayers\Domain\Models\InventoryReceiptLayer;
use Modules\Inventory\StockLedger\Application\Actions\AddManualStockAction;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Organization\Companies\Domain\Models\Company;

$passed = 0;
$failed = 0;
$results = [];

function runTest(string $name, Closure $fn, &$passed, &$failed, array &$results): void
{
    DB::beginTransaction();
    try {
        $fn();
        DB::rollBack();
        $passed++;
        $results[] = ['name' => $name, 'status' => 'PASS'];
        echo "  ✓ $name\n";
    } catch (Throwable $e) {
        try {
            DB::rollBack();
        } catch (Throwable $_) {
        }
        $failed++;
        $results[] = ['name' => $name, 'status' => 'FAIL', 'error' => $e->getMessage()];
        echo "  ✗ $name\n    → {$e->getMessage()}\n";
    }
}

function assertEquals($expected, $actual, string $msg = ''): void
{
    if ((string) $expected !== (string) $actual) {
        throw new RuntimeException("Expected: $expected, Got: $actual. $msg");
    }
}

function assertNotNull($value, string $msg = ''): void
{
    if ($value === null) {
        throw new RuntimeException("Expected non-null. $msg");
    }
}

function assertGreaterThan($min, $actual, string $msg = ''): void
{
    if (! ((float) $actual > (float) $min)) {
        throw new RuntimeException("Expected > $min, Got: $actual. $msg");
    }
}

// ── Schema prerequisite ───────────────────────────────────────────────────────
echo "\n=== SCHEMA CHECK ===\n";
$hasCol = Schema::hasColumn('inventory_receipt_layers', 'company_id');
echo ($hasCol ? '✓' : '✗').' company_id in inventory_receipt_layers: '.($hasCol ? 'EXISTS' : 'MISSING')."\n";
if (! $hasCol) {
    echo "\nRun: php artisan migrate --force\n\n";
    exit(1);
}

// ── Seed: pick existing records ───────────────────────────────────────────────
$companyRow = DB::table('companies')->whereNull('deleted_at')->first();
$warehouseRow = DB::table('warehouses')->where('company_id', $companyRow->id)->first();
$productRow = DB::table('products')->first();

if (! $companyRow || ! $warehouseRow || ! $productRow) {
    echo "\nFATAL: No base records found (need at least 1 company + warehouse + product).\n\n";
    exit(1);
}

$company = Company::find($companyRow->id);
$warehouse = Warehouse::find($warehouseRow->id);
$product = Product::find($productRow->id);

echo "Using: company={$company->id}, warehouse={$warehouse->id}, product={$product->id}\n";

// ── Helper: create a clean InventoryItem ──────────────────────────────────────
function seedItem(Company $company, Warehouse $warehouse, Product $product, float $onHand, float $reserved = 0.0): InventoryItem
{
    // Remove any existing item for this (warehouse, product) pair inside the transaction
    DB::table('inventory_items')
        ->where('warehouse_id', $warehouse->id)
        ->where('product_id', $product->id)
        ->delete();

    return InventoryItem::query()->create([
        'warehouse_id' => $warehouse->id,
        'product_id' => $product->id,
        'company_id' => $company->id,
        'on_hand_qty' => $onHand,
        'reserved_qty' => $reserved,
    ]);
}

// ── Helper: create a FIFO layer ───────────────────────────────────────────────
function seedLayer(Company $company, Warehouse $warehouse, Product $product, float $qty, float $cost): InventoryReceiptLayer
{
    return InventoryReceiptLayer::query()->create([
        'company_id' => $company->id,
        'supplier_id' => null,
        'product_id' => $product->id,
        'goods_receipt_id' => null,
        'goods_receipt_line_id' => null,
        'warehouse_id' => $warehouse->id,
        'received_qty' => $qty,
        'remaining_qty' => $qty,
        'landed_unit_cost' => $cost,
        'sale_price_snapshot' => null,
        'receipt_date' => now()->toDateString(),
    ]);
}

// ═════════════════════════════════════════════════════════════════════════════
echo "\n=== F-INV-C1: FIFO SCHEMA FIX ===\n";

runTest('C1-01: layer stores company_id', function () use ($company, $warehouse, $product) {
    seedItem($company, $warehouse, $product, 10.0);
    $layer = seedLayer($company, $warehouse, $product, 10.0, 100.0);
    assertNotNull($layer->company_id, 'company_id must not be null');
    assertEquals($company->id, $layer->company_id, 'company_id must match warehouse company');
}, $passed, $failed, $results);

runTest('C1-02: consume() succeeds — no SQL column error', function () use ($company, $warehouse, $product) {
    $item = seedItem($company, $warehouse, $product, 10.0);
    seedLayer($company, $warehouse, $product, 10.0, 100.0);

    $result = app(InventoryLayerConsumptionService::class)->consume(
        inventoryItemId: $item->id,
        productId: $product->id,
        warehouseId: $warehouse->id,
        companyId: $company->id,
        quantity: 10.0,
    );

    assertEquals(10.0, $result->totalQuantity, 'totalQuantity must be 10');
    assertEquals(1000.0, $result->totalCost, 'totalCost must be 1000');
}, $passed, $failed, $results);

runTest('C1-03: tenant isolation — Company B cannot consume Company A layers', function () use ($company, $warehouse, $product) {
    // Seed Company A item + layer
    $item = seedItem($company, $warehouse, $product, 10.0);
    seedLayer($company, $warehouse, $product, 10.0, 100.0);

    // Create Company B + Warehouse B
    $companyBId = Str::uuid()->toString();
    $warehouseBId = Str::uuid()->toString();
    $itemBId = Str::uuid()->toString();

    DB::table('companies')->insert([
        'id' => $companyBId, 'code' => 'TST-B', 'name' => 'Test Company B', 'is_active' => 1,
    ]);
    DB::table('warehouses')->insert([
        'id' => $warehouseBId, 'company_id' => $companyBId, 'code' => 'WH-B', 'name' => 'Warehouse B', 'is_active' => 1,
    ]);
    DB::table('inventory_items')->insert([
        'id' => $itemBId, 'warehouse_id' => $warehouseBId, 'product_id' => $product->id,
        'company_id' => $companyBId, 'on_hand_qty' => 10.0, 'reserved_qty' => 0.0,
    ]);

    $threw = false;
    try {
        app(InventoryLayerConsumptionService::class)->consume(
            inventoryItemId: $itemBId,
            productId: $product->id,
            warehouseId: $warehouseBId,
            companyId: $companyBId,
            quantity: 5.0,
        );
    } catch (Modules\Inventory\InventoryItems\Domain\Exceptions\InsufficientStockException $e) {
        $threw = true;
    }

    if (! $threw) {
        throw new RuntimeException('Expected InsufficientStockException — Company B consumed Company A layers!');
    }
}, $passed, $failed, $results);

runTest('C1-04: FIFO cost calculation from layer cost', function () use ($company, $warehouse, $product) {
    $item = seedItem($company, $warehouse, $product, 20.0);
    seedLayer($company, $warehouse, $product, 10.0, 80.0);
    seedLayer($company, $warehouse, $product, 10.0, 120.0);

    $result = app(InventoryLayerConsumptionService::class)->consume(
        inventoryItemId: $item->id,
        productId: $product->id,
        warehouseId: $warehouse->id,
        companyId: $company->id,
        quantity: 10.0,
    );

    // Should consume the first layer (FIFO) @ 80
    assertEquals(10.0, $result->totalQuantity);
    assertEquals(800.0, $result->totalCost, 'FIFO: first-in layer @ 80 consumed first');
}, $passed, $failed, $results);

// ═════════════════════════════════════════════════════════════════════════════
echo "\n=== F-INV-C2: MANUAL STOCK WRITE PATH ===\n";

runTest('C2-01: manual add updates InventoryItem.on_hand_qty', function () use ($warehouse, $product) {
    // Clear existing item so AdjustmentInAction starts fresh
    DB::table('inventory_items')
        ->where('warehouse_id', $warehouse->id)->where('product_id', $product->id)->delete();

    app(AddManualStockAction::class)->execute($product, $warehouse, 10.0, ['unit_cost' => 50.0]);

    $item = app(InventoryItemRepositoryInterface::class)
        ->findByWarehouseAndProduct($warehouse->id, $product->id);

    assertNotNull($item, 'InventoryItem must exist after manual add');
    assertGreaterThan(0, $item->on_hand_qty, 'on_hand_qty must be > 0');
}, $passed, $failed, $results);

runTest('C2-02: manual add creates StockLedgerEntry (adjustment_in)', function () use ($company, $warehouse, $product) {
    DB::table('inventory_items')
        ->where('warehouse_id', $warehouse->id)->where('product_id', $product->id)->delete();
    DB::table('stock_ledger_entries')
        ->where('warehouse_id', $warehouse->id)->where('product_id', $product->id)->delete();

    app(AddManualStockAction::class)->execute($product, $warehouse, 7.0, [
        'unit_cost' => 50.0,
        'notes' => 'VFY test',
    ]);

    $entry = StockLedgerEntry::query()
        ->where('product_id', $product->id)
        ->where('warehouse_id', $warehouse->id)
        ->where('movement_type', 'adjustment_in')
        ->latest()->first();

    assertNotNull($entry, 'StockLedgerEntry must exist');
    $movementValue = $entry->movement_type instanceof BackedEnum
        ? $entry->movement_type->value
        : (string) $entry->movement_type;
    assertEquals('adjustment_in', $movementValue, 'movement_type must be adjustment_in');
    assertEquals(7.0, (float) $entry->quantity);
    assertEquals($company->id, $entry->company_id, 'StockLedgerEntry must be company-scoped');
}, $passed, $failed, $results);

runTest('C2-03: manual add creates FIFO layer with company_id', function () use ($company, $warehouse, $product) {
    DB::table('inventory_items')
        ->where('warehouse_id', $warehouse->id)->where('product_id', $product->id)->delete();

    app(AddManualStockAction::class)->execute($product, $warehouse, 5.0, ['unit_cost' => 80.0]);

    $layer = InventoryReceiptLayer::query()
        ->where('product_id', $product->id)
        ->where('warehouse_id', $warehouse->id)
        ->whereNull('goods_receipt_id')
        ->latest()->first();

    assertNotNull($layer, 'FIFO layer must exist for manual add');
    assertEquals($company->id, $layer->company_id, 'Layer must carry company_id');
    assertEquals(80.0, (float) $layer->landed_unit_cost, 'Layer cost must match supplied unit_cost');
}, $passed, $failed, $results);

runTest('C2-04: manually added stock is FIFO-consumable', function () use ($company, $warehouse, $product) {
    DB::table('inventory_items')
        ->where('warehouse_id', $warehouse->id)->where('product_id', $product->id)->delete();

    app(AddManualStockAction::class)->execute($product, $warehouse, 10.0, ['unit_cost' => 60.0]);

    $item = app(InventoryItemRepositoryInterface::class)
        ->findByWarehouseAndProduct($warehouse->id, $product->id);

    assertNotNull($item, 'InventoryItem must exist');

    $result = app(InventoryLayerConsumptionService::class)->consume(
        inventoryItemId: $item->id,
        productId: $product->id,
        warehouseId: $warehouse->id,
        companyId: $company->id,
        quantity: 10.0,
    );

    assertEquals(10.0, $result->totalQuantity);
    assertEquals(600.0, $result->totalCost, 'COGS = 10 × 60 = 600');
}, $passed, $failed, $results);

runTest('C2-05: legacy stock_movements NOT written by AddManualStockAction', function () use ($warehouse, $product) {
    DB::table('inventory_items')
        ->where('warehouse_id', $warehouse->id)->where('product_id', $product->id)->delete();

    $countBefore = DB::table('stock_movements')->count();

    app(AddManualStockAction::class)->execute($product, $warehouse, 5.0, ['unit_cost' => 40.0]);

    $countAfter = DB::table('stock_movements')->count();
    assertEquals($countBefore, $countAfter, 'stock_movements must NOT be written by AddManualStockAction');
}, $passed, $failed, $results);

// ═════════════════════════════════════════════════════════════════════════════
echo "\n=== F-INV-H6: ATOMICITY — CODE VERIFICATION ===\n";

runTest('H6-01: OrderReservationAudit::record() is inside DB::transaction()', function () {
    $src = file_get_contents(__DIR__.'/Modules/Commerce/Orders/Application/Actions/ShipOrderInventoryAction.php');

    // Verify audit call appears after the $order->update() call and inside the transaction closure
    $transactionPos = strpos($src, 'DB::transaction(function ()');
    $auditPos = strpos($src, 'OrderReservationAudit::record(');
    $closingBrace = strrpos($src, '});'); // last closing brace = end of transaction

    if ($transactionPos === false) {
        throw new RuntimeException('DB::transaction not found in ShipOrderInventoryAction');
    }
    if ($auditPos === false) {
        throw new RuntimeException('OrderReservationAudit::record() not found in ShipOrderInventoryAction');
    }
    if ($auditPos < $transactionPos) {
        throw new RuntimeException('Audit call appears BEFORE the transaction — not atomic!');
    }
    if ($auditPos > $closingBrace) {
        throw new RuntimeException('Audit call appears AFTER the transaction closes — not atomic!');
    }
    // The audit must be inside the transaction (between DB::transaction( and });)
    // Additional check: closing }); of transaction must be AFTER the audit call
    $closingAfterAudit = strpos($src, '});', $auditPos);
    if ($closingAfterAudit === false) {
        throw new RuntimeException('Could not find transaction close after audit call');
    }
    // Passed: audit is inside transaction
}, $passed, $failed, $results);

runTest('H6-02: previousReservationStatus captured before transaction starts', function () {
    $src = file_get_contents(__DIR__.'/Modules/Commerce/Orders/Application/Actions/ShipOrderInventoryAction.php');

    $capturePos = strpos($src, '$previousReservationStatus = $order->reservation_status');
    $transactionPos = strpos($src, 'DB::transaction(function ()');

    if ($capturePos === false) {
        throw new RuntimeException('$previousReservationStatus capture not found');
    }
    if ($transactionPos === false) {
        throw new RuntimeException('DB::transaction not found');
    }
    if ($capturePos > $transactionPos) {
        throw new RuntimeException('previousReservationStatus captured INSIDE transaction — may get stale value');
    }

    // Check it's passed into the closure via use()
    if (strpos($src, '$previousReservationStatus)') === false && strpos($src, 'previousReservationStatus]') === false) {
        // Check for use() clause containing it
        $usePos = strpos($src, ', $previousReservationStatus)');
        if ($usePos === false) {
            throw new RuntimeException('$previousReservationStatus not found in use() clause');
        }
    }
}, $passed, $failed, $results);

runTest('H6-03: order_reservation_audit table has correct schema', function () {
    $cols = Schema::getColumnListing('order_reservation_audits');
    $required = ['id', 'order_id', 'from_status', 'to_status', 'reason', 'warehouse_id', 'actor_id', 'actor_type'];
    foreach ($required as $col) {
        if (! in_array($col, $cols)) {
            throw new RuntimeException("order_reservation_audits missing column: $col");
        }
    }
}, $passed, $failed, $results);

// ═════════════════════════════════════════════════════════════════════════════
echo "\n=== F-INV-C1: CreateReceiptLayersAction code verification ===\n";

runTest('CRL-01: CreateReceiptLayersAction passes company_id to layer', function () {
    $src = file_get_contents(__DIR__.'/Modules/Inventory/ReceiptLayers/Application/Actions/CreateReceiptLayersAction.php');

    if (strpos($src, "'company_id'") === false && strpos($src, '"company_id"') === false) {
        throw new RuntimeException('company_id not passed to InventoryReceiptLayer::create() in CreateReceiptLayersAction');
    }
    // Verify $companyId is assigned before the create() call
    if (strpos($src, '$companyId') === false) {
        throw new RuntimeException('$companyId variable not found in CreateReceiptLayersAction');
    }
}, $passed, $failed, $results);

runTest('CRL-02: InventoryReceiptLayer model has company_id in fillable', function () {
    $src = file_get_contents(__DIR__.'/Modules/Inventory/ReceiptLayers/Domain/Models/InventoryReceiptLayer.php');

    if (strpos($src, "'company_id'") === false) {
        throw new RuntimeException('company_id not in $fillable of InventoryReceiptLayer');
    }
    if (strpos($src, 'company()') === false) {
        throw new RuntimeException('company() BelongsTo relationship missing from InventoryReceiptLayer');
    }
}, $passed, $failed, $results);

// ═════════════════════════════════════════════════════════════════════════════
echo "\n=== RESULTS ===\n";
$total = $passed + $failed;
echo "Tests: $total  Passed: \033[32m$passed\033[0m  Failed: \033[31m$failed\033[0m\n\n";
foreach ($results as $r) {
    $icon = $r['status'] === 'PASS' ? "\033[32m✓\033[0m" : "\033[31m✗\033[0m";
    echo "  $icon {$r['name']}";
    if (isset($r['error'])) {
        echo "\n    → \033[33m{$r['error']}\033[0m";
    }
    echo "\n";
}

$verdict = $failed === 0 ? "\033[32mFOUNDATION RECOVERED\033[0m" : "\033[31mFOUNDATION FAILED ($failed tests failing)\033[0m";
echo "\n=== FINAL VERDICT: $verdict ===\n\n";

exit($failed > 0 ? 1 : 0);
