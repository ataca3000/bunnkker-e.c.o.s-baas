<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Services\WaveEngine;

use BackedEnum;
use Illuminate\Support\Facades\DB;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Operations\Preparation\Domain\Enums\WaveStatus;
use Modules\Operations\Preparation\Domain\Events\OrderAddedToWave;
use Modules\Operations\Preparation\Domain\Events\OrderMovedToPreparing;
use Modules\Operations\Preparation\Domain\Events\OrderRemovedFromWave;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;
use Modules\Operations\Preparation\Domain\Models\PreparationWaveOrder;
use Modules\Operations\Preparation\Domain\Models\WaveEngineConfiguration;

final class WaveMembershipService
{
    public function __construct(
        private readonly DemandRefreshDispatcher $demandDispatcher,
    ) {}

    /**
     * Scan the DB for eligible orders not yet in any wave and attach them.
     * Returns the number of orders newly attached.
     */
    public function attachEligibleOrders(
        PreparationWave $wave,
        WaveEngineConfiguration $config,
        string $actorId = 'system',
    ): int {
        if (! in_array($wave->status, [WaveStatus::Collecting, WaveStatus::Preparing], true)) {
            return 0;
        }

        $orders = Order::where('company_id', $wave->company_id)
            ->where('assigned_warehouse_id', $wave->warehouse_id)
            ->whereIn('status', $config->eligible_order_statuses)
            ->whereNotExists(fn ($q) => $q
                ->select(DB::raw(1))
                ->from('preparation_wave_orders')
                ->whereColumn('preparation_wave_orders.order_id', 'orders.id'),
            )
            ->get();

        $attached = 0;

        foreach ($orders as $order) {
            if ($this->attachOrder($wave, $order, $actorId) !== null) {
                $attached++;
            }
        }

        return $attached;
    }

    /**
     * Attach a single order to a wave.
     * Returns null (silently) when the order is already a member — idempotent by DB UNIQUE constraint.
     */
    public function attachOrder(
        PreparationWave $wave,
        Order $order,
        string $actorId = 'system',
    ): ?PreparationWaveOrder {
        if (! in_array($wave->status, [WaveStatus::Collecting, WaveStatus::Preparing], true)) {
            return null;
        }

        try {
            $waveOrder = DB::transaction(function () use ($wave, $order, $actorId): PreparationWaveOrder {
                return PreparationWaveOrder::create([
                    'company_id' => $wave->company_id,
                    'preparation_wave_id' => $wave->id,
                    'order_id' => $order->id,
                    'order_number' => $order->order_number,
                    'order_confirmed_at' => $order->confirmed_at ?? now(),
                    'customer_name_snapshot' => $order->customer_name ?? null,
                    'delivery_zone_snapshot' => $order->delivery_zone ?? null,
                    'governorate_snapshot' => $order->governorate ?? null,
                    'zone_code_snapshot' => $order->zone_code ?? null,
                    'shipping_cost_snapshot' => $order->shipping_cost ?? null,
                    'is_paid' => in_array(
                        $order->payment_status instanceof BackedEnum
                            ? $order->payment_status->value
                            : (string) ($order->payment_status ?? ''),
                        ['paid', 'partially_paid'],
                        true,
                    ),
                    'payment_status_snapshot' => $order->payment_status instanceof BackedEnum
                        ? $order->payment_status->value
                        : ($order->payment_status ?? null),
                    'preparation_priority' => 5,
                    'added_at' => now(),
                    'added_by' => $actorId,
                ]);
            });
        } catch (\Illuminate\Database\UniqueConstraintViolationException) {
            return null;
        }

        $now = now()->toIso8601String();

        event(new OrderAddedToWave(
            waveId: $wave->id,
            waveNumber: $wave->wave_number,
            companyId: $wave->company_id,
            warehouseId: $wave->warehouse_id,
            orderId: $order->id,
            orderNumber: $order->order_number,
            waveStatus: $wave->status->value,
            addedBy: $actorId,
            addedAt: $now,
        ));

        // Orders joining a Preparing wave immediately enter the preparation phase
        if ($wave->status === WaveStatus::Preparing) {
            event(new OrderMovedToPreparing(
                waveId: $wave->id,
                orderId: $order->id,
                companyId: $wave->company_id,
                warehouseId: $wave->warehouse_id,
                movedBy: $actorId,
                movedAt: $now,
            ));
        }

        $wave->increment('orders_count');

        $this->demandDispatcher->dispatch($wave, 'order_added', $actorId);

        return $waveOrder;
    }

    /**
     * Remove an order from a wave. Returns true if a row was deleted.
     */
    public function detachOrder(
        PreparationWave $wave,
        string $orderId,
        string $actorId = 'system',
        string $reason = 'manual',
    ): bool {
        $deleted = PreparationWaveOrder::where('preparation_wave_id', $wave->id)
            ->where('order_id', $orderId)
            ->delete();

        if ($deleted > 0) {
            event(new OrderRemovedFromWave(
                waveId: $wave->id,
                orderId: $orderId,
                companyId: $wave->company_id,
                warehouseId: $wave->warehouse_id,
                reason: $reason,
                removedBy: $actorId,
            ));

            $wave->decrement('orders_count');

            $this->demandDispatcher->dispatch($wave, 'order_removed', $actorId);
        }

        return $deleted > 0;
    }
}
