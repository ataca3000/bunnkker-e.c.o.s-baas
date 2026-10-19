<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Application\Listeners;

use Illuminate\Support\Facades\Log;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Operations\Fulfillment\Application\FulfillmentEngine;
use Modules\Operations\Fulfillment\Application\Workflows\MoveToPreparationWorkflow;
use Modules\Operations\Preparation\Domain\Events\WavePreparationStarted;
use Throwable;

/**
 * Transitions all orders in an engine-driven wave into Preparing status.
 *
 * C-1 fix: WavePreparationService (engine path) fires WavePreparationStarted, NOT WaveStarted.
 * Previously there was no listener for this event, so the engine-path wave start never
 * transitioned individual orders to Preparing. This listener closes that gap.
 *
 * Mirrors HandlePreparationWaveStarted but handles the WavePreparationStarted event.
 */
final class HandlePreparationWavePreparationStarted
{
    public function __construct(
        private readonly FulfillmentEngine $fulfillmentEngine,
        private readonly MoveToPreparationWorkflow $moveToPreparation,
    ) {}

    public function handle(WavePreparationStarted $event): void
    {
        if (empty($event->orderIds)) {
            return;
        }

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
                Log::channel('daily')->error('[WavePreparationEngine] Failed to transition order to Preparing', [
                    'order_id' => $order->id,
                    'order_number' => $order->order_number,
                    'wave_id' => $waveId,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }
}
