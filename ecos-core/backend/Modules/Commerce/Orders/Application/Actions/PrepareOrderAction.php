<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Illuminate\Support\Facades\Auth;
use Modules\Commerce\Orders\Domain\Contracts\OrderRepositoryInterface;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Commerce\Orders\Domain\Exceptions\OrderNotFoundException;
use Modules\Operations\Fulfillment\Application\FulfillmentEngine;
use Modules\Operations\Fulfillment\Application\Workflows\MoveToPreparationWorkflow;

/**
 * Transitions an order to the Preparing status and triggers manufacturing
 * for every eligible order line.
 *
 * P4/P2 fix: replaced direct $order->update(['status' => Preparing]) with
 * FulfillmentEngine::run(MoveToPreparationWorkflow) so that:
 *  - Inventory reservation is guaranteed before Preparing is set.
 *  - Orders with insufficient stock route to AwaitingStock, not silently enter preparation.
 *  - All audit, guard, and event contracts of the fulfillment pipeline are honoured.
 *
 * PREPARE FLOW:
 *   1. Validate order exists
 *   2. FulfillmentEngine::run(MoveToPreparationWorkflow) — handles reservation + status + audit
 *   3. Call PrepareOrderManufacturingAction — processes each line independently
 *   4. Return updated order
 *
 * IDEMPOTENCY:
 *   Calling prepare on an already-preparing order re-runs only lines that
 *   are not yet Executed (i.e., lines in Failed state are retried automatically).
 */
final class PrepareOrderAction extends BaseAction
{
    public function __construct(
        private readonly OrderRepositoryInterface $orders,
        private readonly PrepareOrderManufacturingAction $manufacturing,
        private readonly FulfillmentEngine $fulfillmentEngine,
        private readonly MoveToPreparationWorkflow $moveToPreparation,
    ) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $id = (string) ($arguments[0] ?? '');

        $order = $this->orders->findById($id);

        if ($order === null) {
            throw new OrderNotFoundException($id);
        }

        $actorId = Auth::id() !== null ? (string) Auth::id() : null;

        // Idempotency: if the order is already Preparing, skip the workflow transition
        // and proceed directly to (re-)running manufacturing for non-executed lines.
        if ($order->status === OrderStatus::ReadyForDispatch) {
            $this->manufacturing->execute($order);
            $updated = $this->orders->findById($id) ?? $order->refresh();

            return OperationResult::success($updated, 'Order already ready for dispatch. Manufacturing re-run for eligible lines.');
        }

        // Transition to Preparing via the canonical pipeline.
        // MoveToPreparationWorkflow handles reservation, guard, audit, and AwaitingStock fallback.
        $result = $this->fulfillmentEngine->run(
            $this->moveToPreparation,
            $order,
            [],
            $actorId,
        );

        $order = $result->order;

        // H-1 fix: only trigger manufacturing when the order successfully entered Preparing.
        // MoveToPreparationWorkflow can reroute to AwaitingStock (insufficient stock path)
        // and return FulfillmentResult::success — manufacturing must NOT run in that case
        // since no Preparing status was set and the order has no active inventory position.
        if ($order->status !== OrderStatus::ReadyForDispatch) {
            $updated = $this->orders->findById($id) ?? $order->refresh();

            return OperationResult::success($updated, 'Order moved to awaiting stock — insufficient inventory. Manufacturing not triggered.');
        }

        // Trigger manufacturing per line — no wrapping transaction intentionally;
        // partial success must be preserved so that retry works correctly.
        $this->manufacturing->execute($order);

        $updated = $this->orders->findById($id) ?? $order->refresh();

        return OperationResult::success($updated, 'Order moved to preparing. Manufacturing triggered for eligible lines.');
    }
}
