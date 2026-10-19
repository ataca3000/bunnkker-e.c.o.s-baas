<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Application\Listeners;

use Illuminate\Support\Facades\Log;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Operations\Fulfillment\Application\FulfillmentEngine;
use Modules\Operations\Fulfillment\Application\Workflows\ReturnToProcessingWorkflow;
use Modules\Operations\Preparation\Domain\Events\WaveCancelled;
use Throwable;

/**
 * Returns Preparing orders to Processing status when a preparation wave is cancelled.
 *
 * DRIFT-013 fix: replaced raw DB::table('orders')->update(['status' => 'processing'])
 * (bypassed Eloquent, used string literal, no enum, no audit trail) with
 * FulfillmentEngine::run(ReturnToProcessingWorkflow) per order so that:
 *  - The audit trail and OrderEvent log are written for every order.
 *  - The guard enforcement layer is satisfied.
 *  - One bad order does not halt the loop — errors are caught per-order and logged.
 */
final class HandlePreparationWaveCancelled
{
    public function __construct(
        private readonly FulfillmentEngine $fulfillmentEngine,
        private readonly ReturnToProcessingWorkflow $returnToProcessing,
    ) {}

    public function handle(WaveCancelled $event): void
    {
        if (empty($event->orderIds)) {
            return;
        }

        // Load Preparing orders via Eloquent (respects soft deletes and company scope).
        $orders = Order::whereIn('id', $event->orderIds)
            ->where('status', OrderStatus::ReadyForDispatch)
            ->get();

        foreach ($orders as $order) {
            try {
                $this->fulfillmentEngine->run(
                    $this->returnToProcessing,
                    $order,
                    ['wave_id' => $event->waveId],
                    null,
                );
            } catch (Throwable $e) {
                Log::channel('daily')->error('[WaveCancellation] Failed to return order to Processing', [
                    'order_id' => $order->id,
                    'order_number' => $order->order_number,
                    'wave_id' => $event->waveId,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }
}
