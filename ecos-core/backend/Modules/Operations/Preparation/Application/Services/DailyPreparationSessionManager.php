<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Operations\Preparation\Domain\Enums\SessionStatus;
use Modules\Operations\Preparation\Domain\Events\OrderAttachedToPreparationSession;
use Modules\Operations\Preparation\Domain\Events\OrderDetachedFromPreparationSession;
use Modules\Operations\Preparation\Domain\Events\PreparationDemandRecalculated;
use Modules\Operations\Preparation\Domain\Events\PreparationSessionAutoCreated;
use Modules\Operations\Preparation\Domain\Events\PreparationSessionClosed;
use Modules\Operations\Preparation\Domain\Events\PreparationSessionFrozen;
use Modules\Operations\Preparation\Domain\Models\PreparationSession;
use Modules\Operations\Preparation\Domain\Models\PreparationSessionOrder;
use Modules\Operations\Preparation\Domain\Models\PreparationSessionPolicy;

/**
 * CR-PREP-001 — Daily Preparation Session Manager.
 *
 * Manages the full lifecycle of auto-created daily sessions:
 *  1. ensureSessionExists()   — called by the scheduler; creates the session if needed.
 *  2. attachEligibleOrders()  — bulk-attaches all qualifying orders to a session.
 *  3. attachOrder()           — attaches a single new order to today's active session.
 *  4. detachOrder()           — removes an ineligible order from its session.
 *  5. recalculateDemand()     — recomputes products_count + orders_count on the session.
 *
 * Eligibility decisions are fully delegated to PreparationReleaseEngine.
 */
final class DailyPreparationSessionManager
{
    public function __construct(
        private readonly PreparationReleaseEngine $releaseEngine,
    ) {}

    /**
     * Ensure that today's Preparation Session exists for a warehouse.
     * Idempotent — if a session already exists for today, returns it without creating another.
     */
    public function ensureSessionExists(Warehouse $warehouse, Carbon $businessDate): PreparationSession
    {
        $existing = PreparationSession::query()
            ->where('warehouse_id', $warehouse->id)
            ->whereDate('planning_date', $businessDate)
            ->whereNotIn('status', ['cancelled'])
            ->first();

        if ($existing !== null) {
            return $existing;
        }

        return DB::transaction(function () use ($warehouse, $businessDate): PreparationSession {
            $policy = $this->resolvePolicy($warehouse->company_id, $warehouse->id);

            $session = PreparationSession::create([
                'company_id' => $warehouse->company_id,
                'warehouse_id' => $warehouse->id,
                'session_number' => $this->generateSessionNumber($warehouse->company_id),
                'planning_date' => $businessDate,
                'status' => 'draft',
                'auto_created' => true,
                'policy_id' => $policy?->id,
                'operator_id' => $warehouse->company_id, // placeholder — supervisor assigns later
                'created_by' => 'system',
                'updated_by' => 'system',
            ]);

            PreparationSessionAutoCreated::dispatch(
                sessionId: $session->id,
                warehouseId: $warehouse->id,
                companyId: $warehouse->company_id,
                businessDate: $businessDate->toDateString(),
                policyId: $policy?->id,
                occurredAt: now()->toIso8601String(),
            );

            if ($policy?->auto_attach_orders ?? true) {
                $this->attachEligibleOrders($session, $policy);
            }

            return $session;
        });
    }

    /**
     * Bulk-attach all orders eligible for preparation in this warehouse today.
     * Eligibility is determined entirely by PreparationReleaseEngine.
     * Skips orders already attached to an active session.
     */
    public function attachEligibleOrders(
        PreparationSession $session,
        ?PreparationSessionPolicy $policy = null,
    ): int {
        // Use the policy's eligible statuses as a DB pre-filter for performance,
        // then confirm each order through the release engine.
        $eligibleStatuses = $policy?->eligible_order_statuses
            ?? PreparationSessionPolicy::defaultEligibleStatuses();

        $orders = Order::query()
            ->where('assigned_warehouse_id', $session->warehouse_id)
            ->whereIn('status', $eligibleStatuses)
            ->whereDoesntHave('activeSessionOrder')
            ->get();

        $attached = 0;
        foreach ($orders as $order) {
            if ($this->releaseEngine->isEligible($order, $policy)) {
                $this->attachOrder($session, $order, 'auto');
                $attached++;
            }
        }

        if ($attached > 0) {
            $this->recalculateDemand($session);
        }

        return $attached;
    }

    /**
     * Freeze a session: stop accepting new orders, stop demand recalculation.
     * After this call, Loading & Allocation OS may consume the session.
     * Orders arriving after freeze go to the NEXT business-day session.
     */
    public function freezeSession(PreparationSession $session, string $frozenBy): void
    {
        if ($session->status->isFrozen()) {
            return; // Already frozen — idempotent.
        }

        $session->update([
            'status' => SessionStatus::Frozen->value,
            'frozen_at' => now(),
            'frozen_by' => $frozenBy,
        ]);

        PreparationSessionFrozen::dispatch(
            sessionId: $session->id,
            warehouseId: $session->warehouse_id,
            companyId: $session->company_id,
            ordersCount: $session->orders_count,
            productsCount: $session->products_count,
            frozenBy: $frozenBy,
            occurredAt: now()->toIso8601String(),
        );
    }

    /**
     * Close a session (terminal state after Loading confirms).
     */
    public function closeSession(PreparationSession $session, string $closedBy): void
    {
        $session->update([
            'status' => SessionStatus::Closed->value,
            'closed_at' => now(),
            'closed_by' => $closedBy,
        ]);

        PreparationSessionClosed::dispatch(
            sessionId: $session->id,
            warehouseId: $session->warehouse_id,
            companyId: $session->company_id,
            closedBy: $closedBy,
            occurredAt: now()->toIso8601String(),
        );
    }

    /**
     * Attach a single order to a session.
     * Used both during bulk-attach and when a new order arrives during the day.
     * Returns null if the session is frozen (order goes to next session).
     */
    public function attachOrder(
        PreparationSession $session,
        Order $order,
        string $source = 'auto',
        ?string $attachedBy = null,
    ): ?PreparationSessionOrder {
        // Frozen sessions reject new attachments — order will join tomorrow's session.
        if ($session->status->isFrozen()) {
            return null;
        }

        // Idempotent: if already attached and not detached, return existing record.
        $existing = PreparationSessionOrder::query()
            ->where('preparation_session_id', $session->id)
            ->where('order_id', $order->id)
            ->whereNull('detached_at')
            ->first();

        if ($existing !== null) {
            return $existing;
        }

        $record = PreparationSessionOrder::create([
            'preparation_session_id' => $session->id,
            'order_id' => $order->id,
            'order_number_snapshot' => $order->order_number,
            'customer_name_snapshot' => $order->billing_first_name.' '.$order->billing_last_name,
            'governorate_snapshot' => $order->governorate,
            'area_snapshot' => $order->area,
            'attachment_source' => $source,
            'attached_at' => now(),
            'attached_by' => $attachedBy,
        ]);

        OrderAttachedToPreparationSession::dispatch(
            sessionId: $session->id,
            orderId: $order->id,
            warehouseId: $session->warehouse_id,
            source: $source,
            occurredAt: now()->toIso8601String(),
        );

        return $record;
    }

    /**
     * Detach an order from its current session.
     * Marks the junction record as detached (audit trail) and dispatches the domain event.
     */
    public function detachOrder(
        PreparationSessionOrder $sessionOrder,
        string $reason,
        ?string $detachedBy = null,
    ): void {
        // Load session BEFORE updating so we can reference warehouse_id in the event.
        $session = $sessionOrder->session;

        $sessionOrder->update([
            'detached_at' => now(),
            'detached_by' => $detachedBy ?? 'system',
            'detachment_reason' => $reason,
        ]);

        OrderDetachedFromPreparationSession::dispatch(
            sessionId: $sessionOrder->preparation_session_id,
            orderId: $sessionOrder->order_id,
            warehouseId: $session?->warehouse_id ?? '',
            reason: $reason,
            detachedBy: $detachedBy ?? 'system',
            occurredAt: now()->toIso8601String(),
        );

        if ($session !== null) {
            $this->recalculateDemand($session);
        }
    }

    /**
     * Recalculate demand summary on the session:
     *  - orders_count: how many orders are actively attached
     *  - products_count: how many distinct SKUs are needed
     */
    public function recalculateDemand(PreparationSession $session): void
    {
        $ordersCount = PreparationSessionOrder::query()
            ->where('preparation_session_id', $session->id)
            ->whereNull('detached_at')
            ->count();

        // Distinct product count via order_lines
        $productsCount = DB::table('order_lines')
            ->join('preparation_session_orders', 'order_lines.order_id', '=', 'preparation_session_orders.order_id')
            ->where('preparation_session_orders.preparation_session_id', $session->id)
            ->whereNull('preparation_session_orders.detached_at')
            ->distinct()
            ->count('order_lines.product_id');

        $session->update([
            'orders_count' => $ordersCount,
            'products_count' => $productsCount,
        ]);

        PreparationDemandRecalculated::dispatch(
            sessionId: $session->id,
            warehouseId: $session->warehouse_id,
            ordersCount: $ordersCount,
            productsCount: $productsCount,
            occurredAt: now()->toIso8601String(),
        );
    }

    /**
     * Find today's active session for a given warehouse, if any.
     */
    public function todaySession(string $warehouseId): ?PreparationSession
    {
        return PreparationSession::query()
            ->where('warehouse_id', $warehouseId)
            ->whereDate('planning_date', today())
            ->whereNotIn('status', ['cancelled', 'closed'])
            ->first();
    }

    /**
     * Get all eligible warehouses under a company that need a session today.
     *
     * @return \Illuminate\Database\Eloquent\Collection<int, Warehouse>
     */
    public function warehousesNeedingSession(string $companyId): \Illuminate\Database\Eloquent\Collection
    {
        $existingWarehouseIds = PreparationSession::query()
            ->where('company_id', $companyId)
            ->whereDate('planning_date', today())
            ->whereNotIn('status', ['cancelled'])
            ->pluck('warehouse_id');

        return Warehouse::query()
            ->where('company_id', $companyId)
            ->where('is_active', true)
            ->whereNotIn('id', $existingWarehouseIds)
            ->get();
    }

    private function resolvePolicy(string $companyId, string $warehouseId): ?PreparationSessionPolicy
    {
        return $this->releaseEngine->resolvePolicy($companyId, $warehouseId);
    }

    private function generateSessionNumber(string $companyId): string
    {
        $prefix = 'PS-'.now()->format('Ymd').'-';
        $last = PreparationSession::query()
            ->where('company_id', $companyId)
            ->where('session_number', 'like', $prefix.'%')
            ->max('session_number');

        $seq = $last !== null
            ? (int) substr((string) $last, strlen($prefix)) + 1
            : 1;

        return $prefix.str_pad((string) $seq, 4, '0', STR_PAD_LEFT);
    }
}
