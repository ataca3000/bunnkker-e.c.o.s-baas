<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Application\Actions;

use Modules\Commerce\Orders\Domain\Enums\OrderLineManufacturingState;
use Modules\Commerce\Orders\Domain\Exceptions\OrderWarehouseNotAssignedException;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Commerce\Orders\Domain\Models\OrderLine;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Operations\OrderLifecycle\Application\DTOs\OrderLifecycleRequest;
use Modules\Operations\OrderLifecycle\Application\DTOs\OrderLifecycleResult;
use Modules\Operations\OrderLifecycle\Application\Services\OrderLifecycleCoordinator;
use Modules\Operations\OrderLifecycle\Domain\Enums\LifecycleAction;

/**
 * Drives per-order-line manufacturing when an order enters the Preparing status.
 *
 * ARCHITECTURE RULE:
 *   This action NEVER calls ManufacturingApplicationService directly.
 *   It calls OrderLifecycleCoordinator, which dispatches to ManufacturingLifecycleHandler.
 *
 * IDEMPOTENCY:
 *   Lines with manufacturing_state = Executed are skipped unconditionally.
 *   All other states (null, Pending, Planned, Failed, Skipped, NotRequired) are re-evaluated,
 *   allowing retry after failure without duplicating successful executions.
 *
 * STATE MAPPING (via LifecycleAction — ManufacturingLifecycleHandler pre-computes distinctions):
 *   ManufacturingTriggered      → Executed
 *   ManufacturingAlreadyExecuted → Executed  (was done before; idempotent)
 *   ManufacturingBlocked        → Failed     (workflow blocked; retry allowed)
 *   ManufacturingNotRequired    → NotRequired (sufficient FG stock; healthy outcome)
 *   PolicyRejected              → Skipped    (product ineligible: no recipe, not manufacturable, etc.)
 *   StatusIgnored               → Skipped    (no handler supports this status)
 *
 * CONTRACT — this action MUST NOT:
 *   - Call manufacturing engines directly (Workflow, Pipeline, Executor)
 *   - Make business eligibility decisions (those live in ManufacturingPolicy via the handler)
 *   - Wrap all lines in a single DB transaction (partial success must be preserved)
 */
final class PrepareOrderManufacturingAction
{
    public function __construct(
        private readonly OrderLifecycleCoordinator $coordinator,
    ) {}

    /**
     * Process every line on the order independently.
     *
     * Lines with `manufacturing_state = Executed` are skipped.
     * All other lines are sent to the coordinator for evaluation.
     *
     * @throws OrderWarehouseNotAssignedException when no warehouse is assigned
     */
    public function execute(Order $order): void
    {
        if ($order->assigned_warehouse_id === null) {
            throw new OrderWarehouseNotAssignedException($order->id);
        }

        $order->loadMissing('lines.product', 'assignedWarehouse');

        $warehouseId = (string) $order->assigned_warehouse_id;
        $companyId = (string) $order->assignedWarehouse->company_id;

        foreach ($order->lines as $line) {
            $this->processLine($line, $order, $warehouseId, $companyId);
        }
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private function processLine(
        OrderLine $line,
        Order $order,
        string $warehouseId,
        string $companyId,
    ): void {
        // Idempotency guard — skip lines that were already successfully manufactured.
        // The coordinator and executor have their own independent guards as fallback.
        if ($line->manufacturing_state === OrderLineManufacturingState::Executed) {
            return;
        }

        $line->update(['manufacturing_started_at' => now()]);

        /** @var Product $product */
        $product = $line->product;

        $request = new OrderLifecycleRequest(
            order_id: (string) $order->id,
            order_line_id: (string) $line->id,
            order_status: $order->status->value,
            is_order_cancelled: $order->status === \Modules\Commerce\Orders\Domain\Enums\OrderStatus::Cancelled,
            product_id: (string) $line->product_id,
            required_qty: $line->quantity,
            product_can_manufacture: (bool) $product->can_manufacture,
            product_has_active_recipe: $product->hasRecipe(),
            product_is_inventory_managed: in_array($product->product_type, Product::TYPES, strict: true),
            warehouse_id: $warehouseId,
            company_id: $companyId,
            actor_id: 'system:order_prepare',
            already_manufactured: false, // Executed lines are skipped above; this is always a fresh attempt
        );

        $lifecycleResult = $this->coordinator->handle($request);

        $this->updateLineState($line, $lifecycleResult);
    }

    private function updateLineState(OrderLine $line, OrderLifecycleResult $result): void
    {
        // ManufacturingLifecycleHandler pre-computes the fine-grained distinctions
        // (not_needed vs blocked, AlreadyManufactured vs other rejections), so this
        // mapping is a clean 1:1 switch on LifecycleAction with no sub-inspections.
        $state = match ($result->action) {
            LifecycleAction::ManufacturingTriggered => OrderLineManufacturingState::Executed,
            LifecycleAction::ManufacturingAlreadyExecuted => OrderLineManufacturingState::Executed,
            LifecycleAction::ManufacturingBlocked => OrderLineManufacturingState::Failed,
            LifecycleAction::ManufacturingNotRequired => OrderLineManufacturingState::NotRequired,
            LifecycleAction::PolicyRejected => OrderLineManufacturingState::Skipped,
            LifecycleAction::StatusIgnored => OrderLineManufacturingState::Skipped,
        };

        $line->update([
            'manufacturing_state' => $state->value,
            'manufacturing_result' => $result->toArray(),
            'manufacturing_completed_at' => now(),
        ]);
    }
}
