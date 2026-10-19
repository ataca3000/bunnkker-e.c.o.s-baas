<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Application;

use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Commerce\Orders\Domain\Models\OrderEvent;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentContext;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentResult;
use Modules\Operations\Fulfillment\Domain\Contracts\FulfillmentWorkflowInterface;

/**
 * Central orchestrator for all fulfillment workflows.
 *
 * CONTRACT:
 *   1. guard()   — validates preconditions outside the transaction (fast-fail)
 *   2. execute() — runs inside DB::transaction (all-or-nothing)
 *   3. events()  — dispatched after commit (never rolled back)
 *   4. audit     — OrderEvent logged after commit
 *
 * Callers never touch inventory, status, or events directly.
 * All business consequences flow through a workflow.
 */
final class FulfillmentEngine
{
    /**
     * Run a workflow against an order.
     *
     * @param  array<string, mixed>  $data  Extra context for the workflow.
     */
    public function run(
        FulfillmentWorkflowInterface $workflow,
        Order $order,
        array $data = [],
        ?string $actorId = null,
    ): FulfillmentResult {
        $ctx = new FulfillmentContext($order, $data, $actorId);

        // 1. Preconditions — outside transaction so guard failures are cheap
        $workflow->guard($ctx);

        // 2. Execute inside transaction — single commit covers all mutations.
        // The status-transition audit stamps (previous_status, status_entered_by,
        // status_entered_at) are written INSIDE the same transaction so they commit
        // atomically with reservation changes, order status, and inventory timestamps.
        // OrderStatusGuard is active for the duration so the Order model's
        // updating hook does not throw UnauthorizedOrderStatusWriteException.
        $previousStatus = $order->status->value;
        $actorName = Auth::user()?->name ?? null;

        OrderStatusGuard::activate();
        try {
            $result = DB::transaction(function () use ($workflow, $ctx, $previousStatus, $actorName): FulfillmentResult {
                $r = $workflow->execute($ctx);

                if ($r->order->status->value !== $previousStatus) {
                    $r->order->update([
                        'previous_status' => $previousStatus,
                        'status_entered_by' => $actorName,
                        'status_entered_at' => now(),
                    ]);
                }

                return $r;
            });
        } finally {
            OrderStatusGuard::deactivate();
        }

        // 3. Events — after commit so they are never rolled back
        foreach ($workflow->events($result) as $event) {
            event($event);
        }

        // 4. Audit trail — includes actor name and previous/new status values
        OrderEvent::log(
            orderId: $result->order->id,
            type: $workflow->name(),
            description: $result->message,
            payload: $result->meta,
            actorId: $actorId,
            actorName: $actorName,
            previousValue: $previousStatus !== $result->order->status->value ? ['status' => $previousStatus] : null,
            newValue: $previousStatus !== $result->order->status->value ? ['status' => $result->order->status->value] : null,
            module: 'fulfillment',
        );

        return $result;
    }
}
