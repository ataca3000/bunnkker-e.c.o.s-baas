<?php

declare(strict_types=1);

namespace Modules\Inventory\CountSessions\Application\Actions;

use Illuminate\Support\Facades\DB;
use Modules\Inventory\CountSessions\Domain\Enums\CountSessionStatus;
use Modules\Inventory\CountSessions\Domain\Models\InventoryCountLine;
use Modules\Inventory\CountSessions\Domain\Models\InventoryCountSession;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

final class CompleteCountSessionAction
{
    public function execute(InventoryCountSession $session): InventoryCountSession
    {
        if (! $session->status->canTransitionTo(CountSessionStatus::Completed)) {
            throw new UnprocessableEntityHttpException(
                "Count session [{$session->count_number}] cannot be completed from status [{$session->status->value}].",
            );
        }

        return DB::transaction(function () use ($session): InventoryCountSession {
            $session->loadMissing('lines');

            foreach ($session->lines as $line) {
                /** @var InventoryCountLine $line */
                if ($line->counted_qty === null) {
                    continue;
                }

                $line->loadMissing('product');

                $countedStr = (string) $line->counted_qty;
                $damagedStr = (string) ($line->damaged_qty ?? '0');
                $systemStr = (string) $line->system_qty;
                $avgCostStr = (string) ($line->product?->average_cost ?? '0');

                // shortage = system - counted - damaged  (> 0 means units are unaccounted)
                $totalAccountedStr = bcadd($countedStr, $damagedStr, 4);
                $shortageQty = bcsub($systemStr, $totalAccountedStr, 4);

                // variance = counted - system  (kept for compatibility; negative when there's a shortage)
                $varianceQty = bcsub($countedStr, $systemStr, 4);
                $varianceValue = bcmul($varianceQty, $avgCostStr, 2);

                $line->update([
                    'shortage_qty' => $shortageQty,
                    'variance_qty' => $varianceQty,
                    'variance_value' => $varianceValue,
                ]);
            }

            $session->update([
                'status' => CountSessionStatus::Completed,
                'completed_at' => now(),
            ]);

            return $session->refresh();
        });
    }
}
