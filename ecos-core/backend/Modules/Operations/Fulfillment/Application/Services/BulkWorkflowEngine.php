<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Application\Services;

use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Operations\Fulfillment\Application\FulfillmentEngine;
use Modules\Operations\Fulfillment\Domain\Contracts\FulfillmentWorkflowInterface;
use Modules\Operations\Fulfillment\Domain\Exceptions\WorkflowPreconditionException;
use Throwable;

/**
 * Runs a workflow against a list of orders in per-order isolation.
 *
 * Each order's workflow runs in its own transaction. A failure on one order
 * rolls back only that order's changes — the rest succeed independently.
 *
 * Closes GAP-04: bulk actions previously updated status only. Now they execute
 * the full workflow (guard → inventory → events → audit) per order.
 */
final class BulkWorkflowEngine
{
    public function __construct(private readonly FulfillmentEngine $engine) {}

    /**
     * @param  list<string>  $orderIds
     * @param  array<string, mixed>  $data  Shared context passed to every workflow
     */
    public function run(
        FulfillmentWorkflowInterface $workflow,
        array $orderIds,
        array $data = [],
        ?string $actorId = null,
    ): BulkWorkflowResult {
        $succeeded = [];
        $failed = [];

        foreach ($orderIds as $orderId) {
            $order = Order::find($orderId);

            if ($order === null) {
                $failed[$orderId] = 'Order not found.';

                continue;
            }

            try {
                $result = $this->engine->run($workflow, $order, $data, $actorId);
                $succeeded[$orderId] = $result;
            } catch (WorkflowPreconditionException $e) {
                $failed[$orderId] = $e->getMessage();
            } catch (Throwable $e) {
                $failed[$orderId] = 'Execution error: '.$e->getMessage();
            }
        }

        return new BulkWorkflowResult($succeeded, $failed);
    }
}
