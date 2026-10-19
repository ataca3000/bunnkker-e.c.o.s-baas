<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingPolicy\Domain\ValueObjects;

/**
 * Product capability facts visible to the Manufacturing Policy.
 *
 * Intentionally decoupled from Modules\Inventory\Products — this value object
 * carries only the boolean flags the policy needs. Callers derive these from
 * the Product model:
 *
 *   can_manufacture       → product->can_manufacture
 *   has_active_recipe     → product->recipe()->where('is_active', true)->exists()
 *   is_inventory_managed  → product is a physical item tracked in inventory
 *                           (caller determines this from product type or category)
 */
final readonly class ProductContext
{
    public function __construct(
        /** UUID of the product being evaluated. */
        public string $product_id,

        /**
         * True when product.can_manufacture = true.
         * Indicates the product has been declared manufacturable in the ERP.
         */
        public bool $can_manufacture,

        /**
         * True when an active Recipe exists for this product.
         * The policy checks this separately from can_manufacture to surface
         * the specific gap (flagged as manufacturable but no recipe defined).
         */
        public bool $has_active_recipe,

        /**
         * True when this product is physically tracked in the inventory system.
         * Service products, digital goods, and virtual items return false.
         * Manufacturing only makes sense for physical inventory-managed goods.
         */
        public bool $is_inventory_managed,
    ) {}
}
