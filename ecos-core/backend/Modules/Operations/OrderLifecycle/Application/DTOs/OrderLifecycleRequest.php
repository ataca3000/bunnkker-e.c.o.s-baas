<?php

declare(strict_types=1);

namespace Modules\Operations\OrderLifecycle\Application\DTOs;

/**
 * Input to OrderLifecycleCoordinator::handle().
 *
 * Represents a single order line that must be evaluated for manufacturing
 * after an order status change.
 *
 * CALLER RESPONSIBILITIES:
 *   - Compute `already_manufactured` by querying ManufacturingTransaction
 *     where order_line_id = $order_line_id
 *   - Compute `product_has_active_recipe` by querying Recipe
 *     where product_id = $product_id AND is_active = true
 *   - Derive `product_is_inventory_managed` from product type / category
 *   - Supply the warehouse_id from the order's assigned_warehouse_id
 *
 * The coordinator does NOT perform DB lookups — all state must be
 * pre-computed and embedded here by the caller.
 */
final readonly class OrderLifecycleRequest
{
    /**
     * @param  array<string, mixed>  $metadata
     */
    public function __construct(
        // ── Order identity ────────────────────────────────────────────────────
        /** UUID of the order that triggered the lifecycle event. */
        public string $order_id,

        /** UUID of the specific order line being evaluated. */
        public string $order_line_id,

        /** Current order status (raw string from OrderStatus::value). */
        public string $order_status,

        /** True when the order is in a cancelled state. */
        public bool $is_order_cancelled,

        // ── Product facts ─────────────────────────────────────────────────────
        /** UUID of the product on this order line. */
        public string $product_id,

        /** Quantity required by this order line. */
        public float $required_qty,

        /** product.can_manufacture flag. */
        public bool $product_can_manufacture,

        /**
         * True when Recipe::where('product_id', $product_id)->where('is_active', true)->exists().
         * Caller queries the BOM table before building this request.
         */
        public bool $product_has_active_recipe,

        /**
         * True when the product is a physical good tracked in the inventory system.
         * Caller derives this from product type or category rules.
         */
        public bool $product_is_inventory_managed,

        // ── Execution context ─────────────────────────────────────────────────
        /** UUID of the warehouse where manufacturing should occur. */
        public string $warehouse_id,

        /** UUID of the company owning the order and the inventory. */
        public string $company_id,

        /** ID of the actor (user / integration) that triggered this lifecycle event. */
        public string $actor_id,

        // ── Prior state ───────────────────────────────────────────────────────
        /**
         * True when ManufacturingTransaction::where('order_line_id', $order_line_id)->exists().
         * Caller queries the transaction table before building this request.
         */
        public bool $already_manufactured,

        /** Caller-supplied metadata propagated through to results. */
        public array $metadata = [],
    ) {}
}
