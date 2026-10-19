<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Application\Listeners;

use Illuminate\Support\Facades\Log;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Operations\Fulfillment\Application\FulfillmentEngine;
use Modules\Operations\Fulfillment\Application\Workflows\MoveToPreparationWorkflow;
use Modules\Operations\Preparation\Domain\Events\WaveStarted;
use Throwable;

/**
 * Transitions all orders in a started wave into Preparing status.
 *
 * P6 fix: replaced direct $order->update(['status' => Preparing]) with
 * FulfillmentEngine::run(MoveToPreparationWorkflow) so that:
 *  - Inventory reservation is guaranteed before Preparing is set.
 *  - Orders with insufficient stock route to AwaitingStock instead of silently entering preparation.
 *  - All guard/audit/event contracts of the fulfillment pipeline are honoured.
 *  - One bad order does not halt the wave — errors are caught per-order and logged.
 */
final class HandlePreparationWaveStarted
{
    public function __construct(
        private readonly FulfillmentEngine $fulfillmentEngine,
        private readonly MoveToPreparationWorkflow $moveToPreparation,
    ) {}

    public function handle(WaveStarted $event): void
    {
        if (empty($event->orderIds)) {
            return;
        }

        // Guard: orders already at or past Preparing must not be regressed.
        $terminalStatuses = [
            OrderStatus::ReadyForDispatch->value,
            OrderStatus::OutForDelivery->value,
            OrderStatus::Delivered->value,
            OrderStatus::Cancelled->value,
            OrderStatus::Returned->value,
        ];

        $actorId = $event->startedBy;
        $waveId = $event->waveId;
        $waveNumber = $event->waveNumber;

        // Load eligible orders via Eloquent (respects global company scope + soft deletes).
        $orders = Order::query()
            ->where('company_id', $event->companyId)
            ->whereIn('id', $event->orderIds)
            ->whereNotIn('status', $terminalStatuses)
            ->get();

        foreach ($orders as $order) {
            try {
                $this->fulfillmentEngine->run(
                    $this->moveToPreparation,
                    $order,
                    ['wave_id' => $waveId, 'wave_number' => $waveNumber],
                    $actorId,
                );
            } catch (Throwable $e) {
                Log::channel('daily')->error('[WaveActivation] Failed to transition order to Preparing via FulfillmentEngine', [
                    'order_id' => $order->id,
                    'order_number' => $order->order_number,
                    'wave_id' => $waveId,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }
}
