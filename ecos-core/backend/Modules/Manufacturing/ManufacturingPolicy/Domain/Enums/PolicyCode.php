<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingPolicy\Domain\Enums;

/**
 * Typed result code returned by ManufacturingPolicy::evaluate().
 *
 * Exactly ONE code is returned per evaluation. Machine-readable so callers
 * can branch on specific policy outcomes without parsing free-text reasons.
 *
 * Eligible
 *   All rules passed — proceed to ManufacturingApplicationService.
 *
 * Ineligible codes (short-circuit order):
 *   OrderCancelled             — checked first; nullifies all other rules
 *   OrderStatusNotAllowed      — status must be pending or processing
 *   ProductCannotManufacture   — product.can_manufacture = false
 *   RecipeNotFound             — product has no active recipe
 *   ProductNotInventoryManaged — product is not tracked by inventory
 *   ManufacturingNotRequired   — required_qty <= 0
 *   AlreadyManufactured        — a transaction already exists for this order line
 */
enum PolicyCode: string
{
    case Eligible = 'eligible';
    case OrderCancelled = 'order_cancelled';
    case OrderStatusNotAllowed = 'order_status_not_allowed';
    case ProductCannotManufacture = 'product_cannot_manufacture';
    case RecipeNotFound = 'recipe_not_found';
    case ProductNotInventoryManaged = 'product_not_inventory_managed';
    case ManufacturingNotRequired = 'manufacturing_not_required';
    case AlreadyManufactured = 'already_manufactured';

    public function label(): string
    {
        return match ($this) {
            self::Eligible => 'Eligible for manufacturing',
            self::OrderCancelled => 'Order is cancelled',
            self::OrderStatusNotAllowed => 'Order status does not allow manufacturing',
            self::ProductCannotManufacture => 'Product cannot be manufactured',
            self::RecipeNotFound => 'No active recipe exists for this product',
            self::ProductNotInventoryManaged => 'Product is not managed by inventory',
            self::ManufacturingNotRequired => 'No quantity requires manufacturing',
            self::AlreadyManufactured => 'Product already manufactured for this order line',
        };
    }

    public function isEligible(): bool
    {
        return $this === self::Eligible;
    }
}
