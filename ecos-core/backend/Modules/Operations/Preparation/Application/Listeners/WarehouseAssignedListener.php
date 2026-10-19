<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Listeners;

use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Operations\Preparation\Application\Services\DailyPreparationSessionManager;
use Modules\Operations\Preparation\Application\Services\PreparationReleaseEngine;
use Modules\Operations\Preparation\Domain\Enums\WarehouseAssignmentSource;
use Modules\Operations\Preparation\Domain\Events\WarehouseAssigned;

/**
 * CR-PREP-001 — When a warehouse is assigned to an order, auto-attach it to today's
 * active preparation session for that warehouse — but only if the Release Engine
 * confirms the order is eligible for preparation.
 */
final class WarehouseAssignedListener
{
    public function __construct(
        private readonly DailyPreparationSessionManager $manager,
        private readonly PreparationReleaseEngine $releaseEngine,
    ) {}

    public function handle(WarehouseAssigned $event): void
    {
        if ($event->source === WarehouseAssignmentSource::Unassigned) {
            return;
        }

        $session = $this->manager->todaySession($event->warehouseId);
        if ($session === null) {
            return;
        }

        $order = Order::find($event->orderId);
        if ($order === null) {
            return;
        }

        // Release Engine is the sole gate — no status checks in this listener.
        $policy = $this->releaseEngine->resolvePolicy($session->company_id, $event->warehouseId);
        if (! $this->releaseEngine->isEligible($order, $policy)) {
            return;
        }

        $this->manager->attachOrder(
            session: $session,
            order: $order,
            source: 'auto',
            attachedBy: null,
        );
    }
}
