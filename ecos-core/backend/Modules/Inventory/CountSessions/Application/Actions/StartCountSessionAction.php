<?php

declare(strict_types=1);

namespace Modules\Inventory\CountSessions\Application\Actions;

use Illuminate\Support\Facades\DB;
use Modules\Inventory\CountSessions\Domain\Enums\CountSessionStatus;
use Modules\Inventory\CountSessions\Domain\Models\InventoryCountSession;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

final class StartCountSessionAction
{
    public function execute(InventoryCountSession $session): InventoryCountSession
    {
        if (! $session->status->canTransitionTo(CountSessionStatus::InProgress)) {
            throw new UnprocessableEntityHttpException(
                "Count session [{$session->count_number}] cannot be started from status [{$session->status->value}].",
            );
        }

        DB::transaction(function () use ($session): void {
            $session->loadMissing('lines');

            // Refresh system_qty to the current on_hand_qty at the moment the
            // count begins, not at the earlier Draft creation time. This gives
            // counters an accurate baseline and prevents phantom variances from
            // receipts that arrived between draft creation and count start.
            $itemIds = $session->lines->pluck('inventory_item_id')->filter()->values()->all();

            if (! empty($itemIds)) {
                $currentQtys = InventoryItem::query()
                    ->whereIn('id', $itemIds)
                    ->pluck('on_hand_qty', 'id');

                foreach ($session->lines as $line) {
                    $line->update([
                        'system_qty' => (float) ($currentQtys->get($line->inventory_item_id) ?? 0),
                    ]);
                }
            }

            $session->update([
                'status' => CountSessionStatus::InProgress,
                'started_at' => now(),
            ]);
        });

        return $session->refresh();
    }
}
