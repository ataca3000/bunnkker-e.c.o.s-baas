<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Application\Listeners;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Modules\Operations\Preparation\Domain\Events\WaveCompleted;

/**
 * Stamps preparation_completed_at on all orders in a completed wave.
 *
 * V2 architecture: there is NO 'ready_for_loading' status. The status transition
 * from Preparing → OutForDelivery is owned by LoadVehicleWorkflow (vehicle dispatch).
 * This listener only records WHEN preparation finished; it does not advance order status.
 *
 * DRIFT-001 fix: removed the fatal OrderStatus::ReadyForLoading reference (enum case
 * was removed in V2) and the raw DB::table status write that bypassed the audit trail.
 */
final class HandlePreparationWaveCompleted
{
    public function handle(WaveCompleted $event): void
    {
        $orderIds = DB::table('preparation_wave_orders')
            ->where('preparation_wave_id', $event->waveId)
            ->pluck('order_id')
            ->filter()
            ->unique()
            ->values();

        if ($orderIds->isEmpty()) {
            Log::info('[HandlePreparationWaveCompleted] Wave completed but no linked orders found', [
                'wave_id' => $event->waveId,
                'wave_number' => $event->waveNumber,
                'completed_at' => $event->completedAt,
            ]);

            return;
        }

        // Stamp the completion timestamp on all Preparing orders.
        // Status does NOT change here — LoadVehicleWorkflow owns the Preparing → OutForDelivery transition.
        $updated = DB::table('orders')
            ->whereIn('id', $orderIds->all())
            ->where('status', 'preparing')
            ->update([
                'preparation_completed_at' => now(),
                'updated_at' => now(),
            ]);

        Log::info('[HandlePreparationWaveCompleted] preparation_completed_at stamped on orders', [
            'wave_id' => $event->waveId,
            'wave_number' => $event->waveNumber,
            'order_count' => $updated,
            'completed_by' => $event->completedBy,
        ]);
    }
}
