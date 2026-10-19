<?php

declare(strict_types=1);

namespace Modules\Operations\OrderLifecycle\Application\Handlers;

use Modules\Manufacturing\ManufacturingPolicy\Domain\Enums\PolicyCode;
use Modules\Manufacturing\ManufacturingPolicy\Domain\Services\ManufacturingPolicy;
use Modules\Manufacturing\ManufacturingPolicy\Domain\ValueObjects\ManufacturingPolicyRequest;
use Modules\Manufacturing\ManufacturingPolicy\Domain\ValueObjects\OrderContext;
use Modules\Manufacturing\ManufacturingPolicy\Domain\ValueObjects\ProductContext;
use Modules\Manufacturing\ManufacturingService\Application\DTOs\Requests\ManufactureProductRequest;
use Modules\Manufacturing\ManufacturingService\Application\Services\ManufacturingApplicationService;
use Modules\Operations\OrderLifecycle\Application\DTOs\OrderLifecycleRequest;
use Modules\Operations\OrderLifecycle\Application\DTOs\OrderLifecycleResult;
use Modules\Operations\OrderLifecycle\Domain\Contracts\LifecycleHandlerInterface;

/**
 * Manufacturing lifecycle handler — plugs into OrderLifecycleCoordinator.
 *
 * Owns ALL manufacturing-specific logic that previously lived in the coordinator:
 *   - Which order statuses trigger manufacturing evaluation
 *   - ManufacturingPolicy eligibility check
 *   - ManufacturingApplicationService invocation
 *   - Result interpretation (not_needed vs blocked, AlreadyManufactured vs rejected)
 *
 * OUTCOME MAPPING:
 *   Policy eligible + mfg executed          → ManufacturingTriggered
 *   Policy rejected (AlreadyManufactured)   → ManufacturingAlreadyExecuted (idempotent; was done before)
 *   Policy rejected (other reasons)         → PolicyRejected (product ineligible)
 *   Mfg blocked (manufacturing_not_needed)  → ManufacturingNotRequired (stock sufficient; healthy outcome)
 *   Mfg blocked (all other reasons)         → ManufacturingBlocked (workflow blocked; investigate)
 *
 * CONTRACT — this handler MUST NOT:
 *   - Call any other application service besides ManufacturingApplicationService
 *   - Read recipes, inventory items, or plans directly
 *   - Update any database record
 *   - Dispatch jobs or events
 */
final class ManufacturingLifecycleHandler implements LifecycleHandlerInterface
{
    /**
     * Order statuses that trigger manufacturing evaluation.
     *
     * @var list<string>
     */
    private const SUPPORTED_STATUSES = [
        'pending',
        'processing',
        'preparing',
    ];

    public function __construct(
        private readonly ManufacturingPolicy $policy,
        private readonly ManufacturingApplicationService $manufacturing,
    ) {}

    public function supports(OrderLifecycleRequest $request): bool
    {
        return in_array($request->order_status, self::SUPPORTED_STATUSES, strict: true);
    }

    public function handle(OrderLifecycleRequest $request): OrderLifecycleResult
    {
        // ── Step 1: Manufacturing Policy evaluation ───────────────────────────
        $policyResult = $this->policy->evaluate(
            new ManufacturingPolicyRequest(
                product_id: $request->product_id,
                required_qty: $request->required_qty,
                actor_id: $request->actor_id,
                metadata: $request->metadata,
            ),
            new OrderContext(
                order_id: $request->order_id,
                order_line_id: $request->order_line_id,
                order_status: $request->order_status,
                is_cancelled: $request->is_order_cancelled,
                already_manufactured: $request->already_manufactured,
            ),
            new ProductContext(
                product_id: $request->product_id,
                can_manufacture: $request->product_can_manufacture,
                has_active_recipe: $request->product_has_active_recipe,
                is_inventory_managed: $request->product_is_inventory_managed,
            ),
        );

        if (! $policyResult->eligible) {
            // AlreadyManufactured is an idempotent outcome, not a failure.
            // Manufacturing was done previously — callers should treat this line as Executed.
            if ($policyResult->policy_code === PolicyCode::AlreadyManufactured) {
                return OrderLifecycleResult::manufacturingAlreadyExecuted(
                    orderId: $request->order_id,
                    orderLineId: $request->order_line_id,
                    policyResult: $policyResult,
                );
            }

            return OrderLifecycleResult::policyRejected(
                orderId: $request->order_id,
                orderLineId: $request->order_line_id,
                policyResult: $policyResult,
            );
        }

        // ── Step 2: Invoke Manufacturing Application Service ──────────────────
        $mfgResponse = $this->manufacturing->manufactureProduct(
            new ManufactureProductRequest(
                product_id: $request->product_id,
                warehouse_id: $request->warehouse_id,
                company_id: $request->company_id,
                required_qty: $request->required_qty,
                actor_id: $request->actor_id,
                trigger_type: 'order_lifecycle',
                trigger_id: $request->order_line_id,
                metadata: array_merge($request->metadata, [
                    'order_id' => $request->order_id,
                    'order_line_id' => $request->order_line_id,
                    'order_status' => $request->order_status,
                ]),
            ),
        );

        if ($mfgResponse->is_blocked) {
            // 'manufacturing_not_needed' = sufficient FG stock already exists.
            // This is a healthy outcome — callers should treat this line as NotRequired, not Failed.
            if ($mfgResponse->blocking_reason === 'manufacturing_not_needed') {
                return OrderLifecycleResult::manufacturingNotRequired(
                    orderId: $request->order_id,
                    orderLineId: $request->order_line_id,
                    policyResult: $policyResult,
                    mfgResult: $mfgResponse,
                );
            }

            return OrderLifecycleResult::manufacturingBlocked(
                orderId: $request->order_id,
                orderLineId: $request->order_line_id,
                policyResult: $policyResult,
                mfgResult: $mfgResponse,
            );
        }

        return OrderLifecycleResult::manufacturingTriggered(
            orderId: $request->order_id,
            orderLineId: $request->order_line_id,
            policyResult: $policyResult,
            mfgResult: $mfgResponse,
        );
    }
}
