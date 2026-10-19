<?php

declare(strict_types=1);

namespace Modules\Purchasing\GoodsReceipts\Infrastructure\Database\Seeders;

use Illuminate\Database\Seeder;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Purchasing\GoodsReceipts\Domain\Enums\GoodsReceiptStatus;
use Modules\Purchasing\GoodsReceipts\Domain\Models\GoodsReceipt;
use Modules\Purchasing\GoodsReceipts\Domain\Models\GoodsReceiptLine;
use Modules\Purchasing\PurchaseOrders\Domain\Enums\PurchaseOrderStatus;
use Modules\Purchasing\PurchaseOrders\Domain\Models\PurchaseOrder;

/**
 * Seeds sample goods receipt GR-00001 referencing PO-00001 (PUR-003).
 */
final class GoodsReceiptSeeder extends Seeder
{
    public function run(): void
    {
        $existing = GoodsReceipt::query()->where('receipt_number', 'GR-00001')->first();
        if ($existing !== null) {
            return;
        }

        $po = PurchaseOrder::query()
            ->with('lines.product')
            ->where('po_number', 'PO-00001')
            ->first();

        if ($po === null) {
            $this->command->warn('GoodsReceiptSeeder: PO-00001 not found — skipping.');

            return;
        }

        if ($po->status !== PurchaseOrderStatus::Approved) {
            $po->update(['status' => PurchaseOrderStatus::Approved->value]);
            $po->refresh();
        }

        $warehouse = Warehouse::query()->where('code', 'WH-MAIN')->first();

        if ($warehouse === null) {
            $this->command->warn('GoodsReceiptSeeder: Main Warehouse (WH-MAIN) not found — skipping.');

            return;
        }

        $poLine = $po->lines->first();

        if ($poLine === null) {
            $this->command->warn('GoodsReceiptSeeder: PO-00001 has no lines — skipping.');

            return;
        }

        /** @var GoodsReceipt $receipt */
        $receipt = GoodsReceipt::query()->create([
            'receipt_number' => 'GR-00001',
            'purchase_order_id' => $po->id,
            'warehouse_id' => $warehouse->id,
            'receipt_date' => now()->toDateString(),
            'status' => GoodsReceiptStatus::Draft->value,
            'notes' => null,
        ]);

        GoodsReceiptLine::query()->create([
            'goods_receipt_id' => $receipt->id,
            'purchase_order_line_id' => $poLine->id,
            'product_id' => $poLine->product_id,
            'ordered_quantity' => (float) $poLine->quantity,
            'received_quantity' => 50,
        ]);
    }
}
