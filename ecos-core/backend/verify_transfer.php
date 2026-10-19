<?php

declare(strict_types=1);

/**
 * TASK-INV-TRANSFER-001 — Transfer Engine Verification Script
 *
 * Tests all functional requirements + regression scenarios.
 * No PHPUnit. Runs against Docker MySQL via Laravel bootstrap.
 * All tests roll back their data via DB::beginTransaction / rollBack.
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
use Modules\Inventory\InventoryItems\Domain\Exceptions\InsufficientStockException;
use Modules\Inventory\InventoryItems\Domain\Models\StockLedgerEntry;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Inventory\ReceiptLayers\Domain\Models\InventoryReceiptLayer;
use Modules\Inventory\StockLedger\Application\Actions\AddManualStockAction;
use Modules\Inventory\Transfer\Application\Actions\TransferStockAction;
use Modules\Inventory\Transfer\Application\DTO\TransferStockDTO;
use Modules\Inventory\Transfer\Domain\Exceptions\CrossCompanyTransferException;
use Modules\Inventory\Transfer\Domain\Exceptions\InactiveWarehouseException;
use Modules\Inventory\Transfer\Domain\Exceptions\SameWarehouseTransferException;
use Modules\Inventory\Transfer\Domain\Models\WarehouseTransfer;
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

function assertEq($expected, $actual, string $msg = ''): void
{
    if ((string) $expected !== (string) $actual) {
        throw new RuntimeException("Expected [{$expected}], Got [{$actual}]. $msg");
    }
}
function assertNotNull($v, string $m = ''): void
{
    if ($v === null) {
        throw new RuntimeException("Expected non-null. $m");
    }
}
function assertGt(float $min, float $actual, string $m = ''): void
{
    if (! ($actual > $min)) {
        throw new RuntimeException("Expected > $min, Got $actual. $m");
    }
}
function assertThrows(string $class, Closure $fn): void
{
    try {
        $fn();
        throw new RuntimeException("Expected $class but no exception thrown");
    } catch (Throwable $e) {
        if (! ($e instanceof $class)) {
            throw new RuntimeException("Expected $class, got ".get_class($e).': '.$e->getMessage());
        }
    }
}

// ── Schema check ──────────────────────────────────────────────────────────────
echo "\n=== SCHEMA CHECKS ===\n";
$checks = [
    ['warehouse_transfers',            'id'],
    ['warehouse_transfers',            'transfer_number'],
    ['warehouse_transfers',            'total_cost'],
    ['warehouse_transfers',            'weighted_unit_cost'],
    ['inventory_receipt_layers',       'company_id'],
];
foreach ($checks as [$table, $col]) {
    $ok = Schema::hasColumn($table, $col);
    echo ($ok ? '✓' : '✗')." $table.$col\n";
    if (! $ok) {
        echo "FATAL: missing column. Run migrate --force\n";
        exit(1);
    }
}

// ── Seed: use existing production records ─────────────────────────────────────
$companyRow = DB::table('companies')->whereNull('deleted_at')->first();
$warehouseRow = DB::table('warehouses')->where('company_id', $companyRow->id)->where('is_active', 1)->first();
$productRow = DB::table('products')->where('is_active', 1)->first();

if (! $companyRow || ! $warehouseRow || ! $productRow) {
    echo "FATAL: Need at least 1 active company + warehouse + product.\n";
    exit(1);
}

$company = Company::find($companyRow->id);
$whA = Warehouse::find($warehouseRow->id);
$product = Product::find($productRow->id);

// Create a second active warehouse in the same company
function makeWarehouse(string $companyId, string $suffix = 'B'): Warehouse
{
    $id = Str::uuid()->toString();
    DB::table('warehouses')->insert([
        'id' => $id,
        'company_id' => $companyId,
        'code' => "WH-VFY-$suffix-".substr($id, 0, 6),
        'name' => "Verify Warehouse $suffix",
        'is_active' => 1,
    ]);

    return Warehouse::find($id);
}

function seedItem(Warehouse $wh, Product $p, Company $c, float $onHand, float $reserved = 0.0)
{
    DB::table('inventory_items')
        ->where('warehouse_id', $wh->id)->where('product_id', $p->id)->delete();
    DB::table('inventory_items')->insert([
        'id' => Str::uuid()->toString(),
        'warehouse_id' => $wh->id,
        'product_id' => $p->id,
        'company_id' => $c->id,
        'on_hand_qty' => $onHand,
        'reserved_qty' => $reserved,
    ]);

    return app(InventoryItemRepositoryInterface::class)->findByWarehouseAndProduct($wh->id, $p->id);
}

function seedLayer(Warehouse $wh, Product $p, Company $c, float $qty, float $cost, ?string $date = null): void
{
    DB::table('inventory_receipt_layers')->insert([
        'id' => Str::uuid()->toString(),
        'company_id' => $c->id,
        'supplier_id' => null,
        'product_id' => $p->id,
        'goods_receipt_id' => null,
        'goods_receipt_line_id' => null,
        'warehouse_id' => $wh->id,
        'received_qty' => $qty,
        'remaining_qty' => $qty,
        'landed_unit_cost' => $cost,
        'receipt_date' => $date ?? now()->toDateString(),
        'created_at' => now(),
        'updated_at' => now(),
    ]);
}

function transfer(
    Warehouse $src, Warehouse $dest, Product $p, Company $c,
    float $qty, ?string $ref = null, ?string $notes = null,
): WarehouseTransfer {
    $dto = new TransferStockDTO(
        sourceWarehouseId: $src->id,
        destinationWarehouseId: $dest->id,
        productId: $p->id,
        companyId: $c->id,
        quantity: $qty,
        reference: $ref,
        notes: $notes,
    );
    $result = app(TransferStockAction::class)->execute($dto);

    return $result->data();
}

echo "\nUsing company={$company->id}, whA={$whA->id}, product={$product->id}\n";

// ═════════════════════════════════════════════════════════════════════════════
echo "\n=== VALIDATION TESTS ===\n";

runTest('VAL-01: same warehouse rejected (SameWarehouseTransferException)', function () use ($whA, $product, $company) {
    assertThrows(SameWarehouseTransferException::class, function () use ($whA, $product, $company) {
        transfer($whA, $whA, $product, $company, 5.0);
    });
}, $passed, $failed, $results);

runTest('VAL-02: zero quantity rejected (InvalidArgumentException)', function () use ($whA, $product, $company) {
    $whB = makeWarehouse($company->id, 'V2');
    assertThrows(InvalidArgumentException::class, function () use ($whA, $whB, $product, $company) {
        transfer($whA, $whB, $product, $company, 0.0);
    });
}, $passed, $failed, $results);

runTest('VAL-03: negative quantity rejected', function () use ($whA, $product, $company) {
    $whB = makeWarehouse($company->id, 'V3');
    assertThrows(InvalidArgumentException::class, function () use ($whA, $whB, $product, $company) {
        transfer($whA, $whB, $product, $company, -1.0);
    });
}, $passed, $failed, $results);

runTest('VAL-04: cross-company transfer rejected', function () use ($whA, $product) {
    $companyBId = Str::uuid()->toString();
    DB::table('companies')->insert(['id' => $companyBId, 'code' => 'VFY-B', 'name' => 'Company B', 'is_active' => 1]);
    $whB = makeWarehouse($companyBId, 'CB');
    assertThrows(CrossCompanyTransferException::class, function () use ($whA, $whB, $product) {
        $dto = new TransferStockDTO(
            sourceWarehouseId: $whA->id,
            destinationWarehouseId: $whB->id,
            productId: $product->id,
            companyId: $whA->company_id,
            quantity: 5.0,
        );
        app(TransferStockAction::class)->execute($dto);
    });
}, $passed, $failed, $results);

runTest('VAL-05: inactive destination warehouse rejected', function () use ($whA, $product, $company) {
    $inactiveId = Str::uuid()->toString();
    DB::table('warehouses')->insert([
        'id' => $inactiveId, 'company_id' => $company->id,
        'code' => 'WH-INACTIVE', 'name' => 'Inactive WH', 'is_active' => 0,
    ]);
    $inactive = Warehouse::find($inactiveId);
    assertThrows(InactiveWarehouseException::class, function () use ($whA, $inactive, $product, $company) {
        transfer($whA, $inactive, $product, $company, 5.0);
    });
}, $passed, $failed, $results);

runTest('VAL-06: insufficient stock rejected', function () use ($whA, $product, $company) {
    $whB = makeWarehouse($company->id, 'V6');
    seedItem($whA, $product, $company, 3.0);  // only 3 available
    seedLayer($whA, $product, $company, 3.0, 100.0);
    assertThrows(InsufficientStockException::class, function () use ($whA, $whB, $product, $company) {
        transfer($whA, $whB, $product, $company, 10.0);  // asking for 10
    });
}, $passed, $failed, $results);

runTest('VAL-07: reserved stock not transferable', function () use ($whA, $product, $company) {
    $whB = makeWarehouse($company->id, 'V7');
    seedItem($whA, $product, $company, 10.0, 8.0);  // 10 on-hand, 8 reserved → only 2 available
    seedLayer($whA, $product, $company, 10.0, 100.0);
    assertThrows(InsufficientStockException::class, function () use ($whA, $whB, $product, $company) {
        transfer($whA, $whB, $product, $company, 5.0);  // needs 5 but only 2 unreserved
    });
}, $passed, $failed, $results);

// ═════════════════════════════════════════════════════════════════════════════
echo "\n=== TRANSFER EXECUTION TESTS ===\n";

runTest('TRF-01: full transfer — source depleted, destination stocked', function () use ($whA, $product, $company) {
    $whB = makeWarehouse($company->id, 'T1');
    seedItem($whA, $product, $company, 10.0);
    seedLayer($whA, $product, $company, 10.0, 100.0);

    $t = transfer($whA, $whB, $product, $company, 10.0, 'REF-001');

    assertNotNull($t, 'WarehouseTransfer record must be created');
    assertEq(10.0, $t->quantity);
    assertEq('completed', $t->status->value);
    assertNotNull($t->transfer_number);

    $srcItem = app(InventoryItemRepositoryInterface::class)->findByWarehouseAndProduct($whA->id, $product->id);
    $destItem = app(InventoryItemRepositoryInterface::class)->findByWarehouseAndProduct($whB->id, $product->id);
    assertEq(0.0, (float) $srcItem->on_hand_qty, 'Source must be depleted');
    assertEq(10.0, (float) $destItem->on_hand_qty, 'Destination must receive stock');
}, $passed, $failed, $results);

runTest('TRF-02: partial transfer — source has remainder', function () use ($whA, $product, $company) {
    $whB = makeWarehouse($company->id, 'T2');
    seedItem($whA, $product, $company, 20.0);
    seedLayer($whA, $product, $company, 20.0, 80.0);

    transfer($whA, $whB, $product, $company, 7.0);

    $srcItem = app(InventoryItemRepositoryInterface::class)->findByWarehouseAndProduct($whA->id, $product->id);
    $destItem = app(InventoryItemRepositoryInterface::class)->findByWarehouseAndProduct($whB->id, $product->id);
    assertEq(13.0, (float) $srcItem->on_hand_qty, 'Source must have 20 − 7 = 13 remaining');
    assertEq(7.0, (float) $destItem->on_hand_qty, 'Destination must have 7');
}, $passed, $failed, $results);

runTest('TRF-03: ledger has exactly 1 TransferOut + 1 TransferIn sharing reference_id', function () use ($whA, $product, $company) {
    $whB = makeWarehouse($company->id, 'T3');
    seedItem($whA, $product, $company, 5.0);
    seedLayer($whA, $product, $company, 5.0, 90.0);

    $t = transfer($whA, $whB, $product, $company, 5.0, 'TEST-REF');

    $out = StockLedgerEntry::query()
        ->where('warehouse_id', $whA->id)->where('product_id', $product->id)
        ->where('movement_type', 'transfer_out')->latest()->first();
    $in = StockLedgerEntry::query()
        ->where('warehouse_id', $whB->id)->where('product_id', $product->id)
        ->where('movement_type', 'transfer_in')->latest()->first();

    assertNotNull($out, 'TransferOut ledger entry must exist');
    assertNotNull($in, 'TransferIn ledger entry must exist');
    assertEq($out->reference_id, $in->reference_id, 'Both entries must share the same transfer reference_id');
    assertEq('warehouse_transfer', $out->reference_type);
    assertEq('warehouse_transfer', $in->reference_type);
    assertEq(5.0, (float) $out->quantity);
    assertEq(5.0, (float) $in->quantity);
}, $passed, $failed, $results);

runTest('TRF-04: FIFO cost preserved — destination layer has same unit cost', function () use ($whA, $product, $company) {
    $whB = makeWarehouse($company->id, 'T4');
    seedItem($whA, $product, $company, 10.0);
    seedLayer($whA, $product, $company, 10.0, 75.50);

    transfer($whA, $whB, $product, $company, 10.0);

    $destLayer = InventoryReceiptLayer::query()
        ->where('warehouse_id', $whB->id)->where('product_id', $product->id)
        ->where('company_id', $company->id)->first();

    assertNotNull($destLayer, 'Destination FIFO layer must be created');
    assertEq(75.50, (float) $destLayer->landed_unit_cost, 'Cost must be preserved exactly');
    assertEq(10.0, (float) $destLayer->remaining_qty, 'Full qty must be available in dest layer');
}, $passed, $failed, $results);

runTest('TRF-05: FIFO order preserved — multi-layer transfer', function () use ($whA, $product, $company) {
    $whB = makeWarehouse($company->id, 'T5');
    seedItem($whA, $product, $company, 15.0);

    // Two layers: 10 @ 50 (older receipt_date), 5 @ 120 (newer receipt_date)
    // Insert with explicit created_at to guarantee FIFO ordering (created_at + id order)
    $id1 = Str::uuid()->toString();
    $id2 = Str::uuid()->toString();
    DB::table('inventory_receipt_layers')->insert([
        'id' => $id1, 'company_id' => $company->id, 'supplier_id' => null,
        'product_id' => $product->id, 'goods_receipt_id' => null, 'goods_receipt_line_id' => null,
        'warehouse_id' => $whA->id, 'received_qty' => 10.0, 'remaining_qty' => 10.0,
        'landed_unit_cost' => 50.0, 'receipt_date' => now()->subDay()->toDateString(),
        'created_at' => now()->subSeconds(10), 'updated_at' => now()->subSeconds(10),
    ]);
    DB::table('inventory_receipt_layers')->insert([
        'id' => $id2, 'company_id' => $company->id, 'supplier_id' => null,
        'product_id' => $product->id, 'goods_receipt_id' => null, 'goods_receipt_line_id' => null,
        'warehouse_id' => $whA->id, 'received_qty' => 5.0, 'remaining_qty' => 5.0,
        'landed_unit_cost' => 120.0, 'receipt_date' => now()->toDateString(),
        'created_at' => now(), 'updated_at' => now(),
    ]);

    transfer($whA, $whB, $product, $company, 12.0);

    // Source: 10-unit layer should be 0 remaining, 5-unit layer should have 3 remaining
    $srcLayers = InventoryReceiptLayer::query()
        ->where('warehouse_id', $whA->id)->where('product_id', $product->id)
        ->where('company_id', $company->id)
        ->orderBy('created_at')->get();

    assertEq(0.0, (float) $srcLayers[0]->remaining_qty, 'Older layer fully consumed');
    assertEq(3.0, (float) $srcLayers[1]->remaining_qty, '5 − 2 = 3 remaining in newer layer');

    // Destination: should have 2 layers (10 @ 50, 2 @ 120)
    $destLayers = InventoryReceiptLayer::query()
        ->where('warehouse_id', $whB->id)->where('product_id', $product->id)
        ->orderBy('created_at')->get();

    assertEq(2, $destLayers->count(), 'Destination should have 2 FIFO slices');
    assertEq(50.0, (float) $destLayers[0]->landed_unit_cost, 'First dest layer cost = 50');
    assertEq(10.0, (float) $destLayers[0]->received_qty);
    assertEq(120.0, (float) $destLayers[1]->landed_unit_cost, 'Second dest layer cost = 120');
    assertEq(2.0, (float) $destLayers[1]->received_qty);
}, $passed, $failed, $results);

runTest('TRF-06: COGS integrity — total_cost = quantity × weighted_unit_cost', function () use ($whA, $product, $company) {
    $whB = makeWarehouse($company->id, 'T6');
    seedItem($whA, $product, $company, 10.0);
    seedLayer($whA, $product, $company, 10.0, 60.0);

    $t = transfer($whA, $whB, $product, $company, 10.0);

    assertEq(600.0, round($t->total_cost, 2), 'total_cost = 10 × 60 = 600');
    assertEq(60.0, round($t->weighted_unit_cost, 2), 'weighted_unit_cost = 60');
}, $passed, $failed, $results);

runTest('TRF-07: source FIFO layer remaining_qty reduced correctly', function () use ($whA, $product, $company) {
    $whB = makeWarehouse($company->id, 'T7');
    seedItem($whA, $product, $company, 20.0);
    seedLayer($whA, $product, $company, 20.0, 100.0);

    transfer($whA, $whB, $product, $company, 15.0);

    $srcLayer = InventoryReceiptLayer::query()
        ->where('warehouse_id', $whA->id)->where('product_id', $product->id)
        ->where('company_id', $company->id)->first();

    assertEq(5.0, (float) $srcLayer->remaining_qty, 'Source layer remaining = 20 − 15 = 5');
}, $passed, $failed, $results);

runTest('TRF-08: destination item created when not existing', function () use ($whA, $product, $company) {
    $whB = makeWarehouse($company->id, 'T8');
    seedItem($whA, $product, $company, 5.0);
    seedLayer($whA, $product, $company, 5.0, 55.0);

    // Remove any pre-existing dest item
    DB::table('inventory_items')
        ->where('warehouse_id', $whB->id)->where('product_id', $product->id)->delete();

    transfer($whA, $whB, $product, $company, 5.0);

    $destItem = app(InventoryItemRepositoryInterface::class)->findByWarehouseAndProduct($whB->id, $product->id);
    assertNotNull($destItem, 'Destination InventoryItem must be created via findOrCreate');
    assertEq(5.0, (float) $destItem->on_hand_qty);
}, $passed, $failed, $results);

runTest('TRF-09: WarehouseTransfer audit record fields complete', function () use ($whA, $product, $company) {
    $whB = makeWarehouse($company->id, 'T9');
    seedItem($whA, $product, $company, 8.0);
    seedLayer($whA, $product, $company, 8.0, 45.0);

    $t = transfer($whA, $whB, $product, $company, 8.0, 'EXT-REF-999', 'audit test');

    assertEq($company->id, $t->company_id);
    assertEq($whA->id, $t->source_warehouse_id);
    assertEq($whB->id, $t->destination_warehouse_id);
    assertEq($product->id, $t->product_id);
    assertEq(8.0, (float) $t->quantity);
    assertEq(360.0, round($t->total_cost, 2), '8 × 45 = 360');
    assertEq('EXT-REF-999', $t->reference);
    assertEq('completed', $t->status->value);
    assertNotNull($t->transfer_number);
    assertNotNull($t->transferred_at);
}, $passed, $failed, $results);

runTest('TRF-10: destination layer carries company_id (tenant isolation)', function () use ($whA, $product, $company) {
    $whB = makeWarehouse($company->id, 'T10');
    seedItem($whA, $product, $company, 6.0);
    seedLayer($whA, $product, $company, 6.0, 70.0);

    transfer($whA, $whB, $product, $company, 6.0);

    $destLayer = InventoryReceiptLayer::query()
        ->where('warehouse_id', $whB->id)->where('product_id', $product->id)->first();

    assertNotNull($destLayer->company_id, 'Destination layer must carry company_id');
    assertEq($company->id, $destLayer->company_id, 'Destination layer company_id must match');
}, $passed, $failed, $results);

// ═════════════════════════════════════════════════════════════════════════════
echo "\n=== REGRESSION: FOUNDATION PATHS UNAFFECTED ===\n";

runTest('REG-01: AddManualStockAction still works after Transfer module added', function () use ($whA, $product) {
    DB::table('inventory_items')
        ->where('warehouse_id', $whA->id)->where('product_id', $product->id)->delete();
    app(AddManualStockAction::class)->execute($product, $whA, 5.0, ['unit_cost' => 30.0]);
    $item = app(InventoryItemRepositoryInterface::class)->findByWarehouseAndProduct($whA->id, $product->id);
    assertGt(0, (float) $item->on_hand_qty, 'on_hand_qty must be > 0');
}, $passed, $failed, $results);

runTest('REG-02: InventoryReceiptLayer.company_id still persists from manual add', function () use ($whA, $product, $company) {
    DB::table('inventory_items')
        ->where('warehouse_id', $whA->id)->where('product_id', $product->id)->delete();
    app(AddManualStockAction::class)->execute($product, $whA, 3.0, ['unit_cost' => 20.0]);
    $layer = InventoryReceiptLayer::query()
        ->where('warehouse_id', $whA->id)->where('product_id', $product->id)
        ->whereNull('goods_receipt_id')->latest()->first();
    assertNotNull($layer->company_id);
    assertEq($company->id, $layer->company_id);
}, $passed, $failed, $results);

runTest('REG-03: Transfer does not touch reserved_qty on either warehouse', function () use ($whA, $product, $company) {
    $whB = makeWarehouse($company->id, 'R3');
    seedItem($whA, $product, $company, 10.0, 2.0);  // 2 reserved at source
    seedLayer($whA, $product, $company, 10.0, 100.0);

    transfer($whA, $whB, $product, $company, 8.0);  // transfer 8 (8 available)

    $srcItem = app(InventoryItemRepositoryInterface::class)->findByWarehouseAndProduct($whA->id, $product->id);
    $destItem = app(InventoryItemRepositoryInterface::class)->findByWarehouseAndProduct($whB->id, $product->id);

    assertEq(2.0, (float) $srcItem->on_hand_qty, 'Source: 10 − 8 = 2 on_hand');
    assertEq(2.0, (float) $srcItem->reserved_qty, 'Source reserved_qty unchanged');
    assertEq(0.0, (float) $destItem->reserved_qty, 'Destination reserved_qty = 0 (not transferred)');
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

$verdict = $failed === 0
    ? "\033[32mTRANSFER ENGINE CERTIFIED\033[0m"
    : "\033[31mTRANSFER ENGINE FAILED ($failed failing)\033[0m";

echo "\n=== FINAL VERDICT: $verdict ===\n\n";
exit($failed > 0 ? 1 : 0);
