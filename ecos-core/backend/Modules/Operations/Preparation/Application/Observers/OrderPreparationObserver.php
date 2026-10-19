<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Observers;

use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Operations\Preparation\Application\Services\DailyPreparationSessionManager;
use Modules\Operations\Preparation\Application\Services\PreparationReleaseEngine;

/**
 * CR-PREP-001HF — Auto Detach.
 *
 * Watches Order model changes and auto-detaches from any active Preparation Session
 * when the order is no longer eligible. Four triggers:
 *
 *  1. Status became ineligible (cancelled, rejected, on_hold, or any status absent
 *     from the policy's eligible_order_statuses list).
 *  2. Warehouse reassigned — order no longer belongs to this session's warehouse.
 *
 * Eligibility decisions are fully delegated to PreparationReleaseEngine.
 * No hardcoded status strings exist in this class.
 */
final class OrderPreparationObserver
{
    public function __construct(
        private readonly DailyPreparationSessionManager $manager,
        private readonly PreparationReleaseEngine $releaseEngine,
    ) {}

    public function updated(Order $order): void
    {
        // Quick exit — only act when preparation-relevant fields change.
        if (! $order->wasChanged(['status', 'assigned_warehouse_id'])) {
            return;
        }

        // Query the active session order directly (avoids stale cached relations).
        $sessionOrder = $order->activeSessionOrder()->first();
        if ($sessionOrder === null) {
            return;
        }

        $session = $sessionOrder->session;
        if ($session === null) {
            return;
        }

        // ── Trigger 1: Warehouse reassigned ──────────────────────────────────
        // The order's warehouse changed — it belongs to a different warehouse now.
        // Detach from the current session; WarehouseAssignedListener will attach
        // it to the new warehouse's session.
        if ($order->wasChanged('assigned_warehouse_id')
            && $order->assigned_warehouse_id !== $session->warehouse_id) {
            $this->manager->detachOrder(
                sessionOrder: $sessionOrder,
                reason: 'warehouse_reassigned',
                detachedBy: 'system',
            );

            return;
        }

        // ── Trigger 2: Status changed — check via Release Engine ─────────────
        if ($order->wasChanged('status')) {
            $policy = $this->releaseEngine->resolvePolicy(
                $session->company_id,
                $session->warehouse_id,
            );

            if (! $this->releaseEngine->isEligible($order, $policy)) {
                $reason = $this->releaseEngine->ineligibilityReason($order, $policy)
                    ?? 'status_ineligible';
                $this->manager->detachOrder(
                    sessionOrder: $sessionOrder,
                    reason: $reason,
                    detachedBy: 'system',
                );
            }
        }
    }
}
