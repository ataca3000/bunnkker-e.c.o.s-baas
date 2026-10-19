<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Application\Actions;

use Illuminate\Support\Facades\Auth;
use Modules\Commerce\Orders\Domain\Enums\ReservationStatus;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Commerce\Orders\Domain\Models\OrderReservationAudit;

/**
 * Canonical writer for Order.reservation_status.
 *
 * All reservation state transitions must flow through this action so that:
 * 1. The OrderReservationAudit trail is always written atomically with the status update.
 * 2. There is exactly one place in the codebase that writes reservation_status.
 *
 * Pass $toStatus = null to clear the reservation status (structural reset — no audit written).
 */
final class UpdateReservationStatusAction
{
    public function execute(
        Order $order,
        ?ReservationStatus $toStatus,
        ?string $reason = null,
        ?string $warehouseId = null,
        ?string $vehicleId = null,
        ?array $meta = null,
    ): void {
        $fromStatus = $order->reservation_status?->value;

        $update = ['reservation_status' => $toStatus?->value];

        // Clear failure reason on any transition; callers pass it when applicable.
        $update['reservation_failure_reason'] = $reason;

        $order->update($update);
        $order->refresh();

        if ($toStatus !== null) {
            OrderReservationAudit::record(
                orderId: $order->id,
                fromStatus: $fromStatus,
                toStatus: $toStatus->value,
                reason: $reason,
                warehouseId: $warehouseId,
                vehicleId: $vehicleId,
                meta: $meta,
                actorId: Auth::id(),
                actorType: Auth::check() ? 'user' : 'system',
            );
        }
    }
}
