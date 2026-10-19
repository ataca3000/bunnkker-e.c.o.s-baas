<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseOrders\Infrastructure\Database\Seeders;

use Illuminate\Database\Seeder;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Purchasing\PurchaseOrders\Domain\Enums\PurchaseOrderStatus;
use Modules\Purchasing\PurchaseOrders\Domain\Models\PurchaseOrder;
use Modules\Purchasing\PurchaseOrders\Domain\Models\PurchaseOrderLine;
use Modules\Purchasing\Suppliers\Domain\Models\Supplier;

/**
 * Seeds sample purchase orders (PUR-002).
 */
final class PurchaseOrderSeeder extends Seeder
{
    public function run(): void
    {
        $supplier = Supplier::query()->where('code', 'SUP-001')->first();
        $product = Product::query()->where('product_type', 'raw_material')->first();

        if ($supplier === null || $product === null) {
            $this->command->warn('PurchaseOrderSeeder: supplier SUP-001 or a raw_material product not found — skipping.');

            return;
        }

        $existing = PurchaseOrder::query()->where('po_number', 'PO-00001')->first();

        if ($existing !== null) {
            return;
        }

        $quantity = 100;
        $unitPrice = 50.00;
        $lineTotal = $quantity * $unitPrice;

        /** @var PurchaseOrder $order */
        $order = PurchaseOrder::query()->create([
            'po_number' => 'PO-00001',
            'supplier_id' => $supplier->id,
            'order_date' => now()->toDateString(),
            'expected_date' => null,
            'status' => PurchaseOrderStatus::Draft->value,
            'notes' => null,
            'subtotal' => $lineTotal,
            'total' => $lineTotal,
        ]);

        PurchaseOrderLine::query()->create([
            'purchase_order_id' => $order->id,
            'product_id' => $product->id,
            'quantity' => $quantity,
            'unit_price' => $unitPrice,
            'line_total' => $lineTotal,
        ]);
    }
}
