<?php

declare(strict_types=1);

namespace Modules\Inventory\CountSessions\Application\Actions;

use Illuminate\Support\Facades\DB;
use Modules\Inventory\CountSessions\Domain\Enums\CountSessionStatus;
use Modules\Inventory\CountSessions\Domain\Models\InventoryCountLine;
use Modules\Inventory\CountSessions\Domain\Models\InventoryCountSession;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;

final class CreateCountSessionAction
{
    /**
     * @param array{
     *   company_id: string,
     *   warehouse_id: string,
     *   notes?: string|null,
     *   created_by?: string|null,
     *   product_ids?: list<string>,
     * } $data
     */
    public function execute(array $data): InventoryCountSession
    {
        return DB::transaction(function () use ($data): InventoryCountSession {
            $session = InventoryCountSession::query()->create([
                'company_id' => $data['company_id'],
                'warehouse_id' => $data['warehouse_id'],
                'count_number' => $this->nextCountNumber(),
                'status' => CountSessionStatus::Draft,
                'notes' => $data['notes'] ?? null,
                'created_by' => $data['created_by'] ?? null,
            ]);

            // If specific product_ids given, use those; otherwise load all items in warehouse
            $productIds = $data['product_ids'] ?? null;

            $items = InventoryItem::query()
                ->where('warehouse_id', $data['warehouse_id'])
                ->when($productIds !== null, fn ($q) => $q->whereIn('product_id', $productIds))
                ->get();

            foreach ($items as $item) {
                InventoryCountLine::query()->create([
                    'session_id' => $session->id,
                    'product_id' => $item->product_id,
                    'inventory_item_id' => $item->id,
                    'system_qty' => (float) $item->on_hand_qty,
                    'counted_qty' => null,
                    'variance_qty' => null,
                    'variance_value' => null,
                ]);
            }

            return $session->load('lines.product', 'warehouse');
        });
    }

    private function nextCountNumber(): string
    {
        // lockForUpdate prevents concurrent requests from reading the same max and
        // producing duplicate count numbers. Must be called inside a transaction.
        // Zero-padded format (CNT-00001…CNT-99999) means lexicographic DESC = numeric DESC.
        $last = InventoryCountSession::query()
            ->lockForUpdate()
            ->orderByDesc('count_number')
            ->value('count_number');

        if ($last === null) {
            return 'CNT-00001';
        }

        $current = (int) str_replace('CNT-', '', (string) $last);

        return 'CNT-'.str_pad((string) ($current + 1), 5, '0', STR_PAD_LEFT);
    }
}
