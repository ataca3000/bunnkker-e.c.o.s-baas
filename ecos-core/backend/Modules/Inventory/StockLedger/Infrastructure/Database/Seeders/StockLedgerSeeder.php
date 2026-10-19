<?php

declare(strict_types=1);

namespace Modules\Inventory\StockLedger\Infrastructure\Database\Seeders;

use Illuminate\Database\Seeder;
use Modules\Inventory\StockLedger\Domain\Models\StockMovement;
use Modules\Purchasing\GoodsReceipts\Application\Actions\PostGoodsReceiptAction;
use Modules\Purchasing\GoodsReceipts\Domain\Models\GoodsReceipt;

/**
 * Seeds the stock ledger by posting GR-00001 (creates movements via PostGoodsReceiptAction).
 */
final class StockLedgerSeeder extends Seeder
{
    public function run(): void
    {
        $receipt = GoodsReceipt::query()->where('receipt_number', 'GR-00001')->first();

        if ($receipt === null) {
            $this->command->warn('StockLedgerSeeder: GR-00001 not found — skipping.');

            return;
        }

        if ($receipt->status->value === 'posted') {
            $existing = StockMovement::query()
                ->where('reference_type', 'goods_receipt')
                ->where('reference_id', $receipt->id)
                ->exists();

            if ($existing) {
                $this->command->info('StockLedgerSeeder: GR-00001 already posted with ledger entries — skipping.');

                return;
            }
        }

        if ($receipt->status->value === 'draft') {
            /** @var PostGoodsReceiptAction $action */
            $action = app(PostGoodsReceiptAction::class);
            $action->execute($receipt->id);
            $this->command->info('StockLedgerSeeder: GR-00001 posted — ledger entry created.');
        }
    }
}
