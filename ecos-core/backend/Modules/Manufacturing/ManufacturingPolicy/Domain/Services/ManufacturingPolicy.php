<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingPolicy\Domain\Services;

use Modules\Manufacturing\ManufacturingPolicy\Domain\Enums\PolicyCode;
use Modules\Manufacturing\ManufacturingPolicy\Domain\ValueObjects\ManufacturingPolicyRequest;
use Modules\Manufacturing\ManufacturingPolicy\Domain\ValueObjects\ManufacturingPolicyResult;
use Modules\Manufacturing\ManufacturingPolicy\Domain\ValueObjects\OrderContext;
use Modules\Manufacturing\ManufacturingPolicy\Domain\ValueObjects\ProductContext;

/**
 * Manufacturing Policy — pure domain eligibility evaluator.
 *
 * Evaluates seven rules in priority order and short-circuits at the first
 * failure. Returns a typed ManufacturingPolicyResult for every outcome.
 *
 * CONTRACT — this service MUST NOT:
 *   - Call ManufacturingApplicationService
 *   - Call ManufacturingExecutor
 *   - Call ManufacturingPlanner
 *   - Consume inventory
 *   - Update any database record
 *   - Dispatch jobs or events
 *
 * The caller decides what to do with an eligible result. This service
 * never invokes ManufacturingApplicationService itself.
 *
 * Rule evaluation order (highest-priority first):
 *   1. Order not cancelled            — order-level hard stop
 *   2. Order status allows mfg        — pending | processing only
 *   3. Product can manufacture        — product.can_manufacture flag
 *   4. Recipe exists                  — product has an active recipe
 *   5. Product is inventory-managed   — physical trackable good
 *   6. Manufacturing required         — required_qty > 0
 *   7. Product not already mfd        — no existing transaction for this line
 */
final class ManufacturingPolicy
{
    /**
     * Order statuses that permit manufacturing to proceed.
     *
     * Derived from OrderStatus enum in the Commerce module:
     *   pending    → order placed, awaiting fulfilment
     *   processing → order accepted, manufacturing may begin
     *
     * NOT allowed:
     *   completed  → order already fulfilled; manufacturing is unnecessary
     *   cancelled  → caught by Rule 1 (is_cancelled) before reaching here
     *
     * @var list<string>
     */
    private const MANUFACTURING_ALLOWED_STATUSES = [
        'pending',
        'processing',
        'preparing', // PKG-07: order is in the process of being prepared for manufacturing
    ];

    /**
     * Evaluate all policy rules and return a typed eligibility result.
     *
     * Never throws for business outcomes. Only ever returns
     * ManufacturingPolicyResult — the caller inspects result->eligible.
     */
    public function evaluate(
        ManufacturingPolicyRequest $request,
        OrderContext $order,
        ProductContext $product,
    ): ManufacturingPolicyResult {
        $context = array_merge($request->metadata, [
            'product_id' => $request->product_id,
            'order_id' => $order->order_id,
            'order_line_id' => $order->order_line_id,
        ]);

        // ── Rule 1: Order not cancelled ───────────────────────────────────────
        // Checked first — a cancelled order supersedes all other rules.
        if ($order->is_cancelled) {
            return ManufacturingPolicyResult::ineligible(
                code: PolicyCode::OrderCancelled,
                reason: 'The order is cancelled. Manufacturing cannot proceed.',
                metadata: $context,
            );
        }

        // ── Rule 2: Order status allows manufacturing ─────────────────────────
        if (! in_array($order->order_status, self::MANUFACTURING_ALLOWED_STATUSES, strict: true)) {
            return ManufacturingPolicyResult::ineligible(
                code: PolicyCode::OrderStatusNotAllowed,
                reason: "Order status '{$order->order_status}' does not allow manufacturing. "
                    .'Allowed: '.implode(', ', self::MANUFACTURING_ALLOWED_STATUSES).'.',
                metadata: array_merge($context, ['order_status' => $order->order_status]),
            );
        }

        // ── Rule 3: Product can manufacture ──────────────────────────────────
        if (! $product->can_manufacture) {
            return ManufacturingPolicyResult::ineligible(
                code: PolicyCode::ProductCannotManufacture,
                reason: 'Product is not flagged as manufacturable (can_manufacture = false).',
                metadata: $context,
            );
        }

        // ── Rule 4: Recipe exists ─────────────────────────────────────────────
        if (! $product->has_active_recipe) {
            return ManufacturingPolicyResult::ineligible(
                code: PolicyCode::RecipeNotFound,
                reason: 'No active recipe (Bill of Materials) exists for this product.',
                metadata: $context,
            );
        }

        // ── Rule 5: Product is managed by inventory ───────────────────────────
        if (! $product->is_inventory_managed) {
            return ManufacturingPolicyResult::ineligible(
                code: PolicyCode::ProductNotInventoryManaged,
                reason: 'Product is not tracked by the inventory system. '
                    .'Manufacturing only applies to physical inventory-managed goods.',
                metadata: $context,
            );
        }

        // ── Rule 6: Manufacturing required ────────────────────────────────────
        if ($request->required_qty <= 0.0) {
            return ManufacturingPolicyResult::ineligible(
                code: PolicyCode::ManufacturingNotRequired,
                reason: 'Required quantity is zero or negative. No manufacturing needed.',
                metadata: array_merge($context, ['required_qty' => $request->required_qty]),
            );
        }

        // ── Rule 7: Product not already manufactured ──────────────────────────
        if ($order->already_manufactured) {
            return ManufacturingPolicyResult::ineligible(
                code: PolicyCode::AlreadyManufactured,
                reason: 'A manufacturing transaction already exists for this order line.',
                metadata: $context,
            );
        }

        // ── All rules passed ──────────────────────────────────────────────────
        return ManufacturingPolicyResult::eligible(
            metadata: array_merge($context, ['required_qty' => $request->required_qty]),
        );
    }
}
