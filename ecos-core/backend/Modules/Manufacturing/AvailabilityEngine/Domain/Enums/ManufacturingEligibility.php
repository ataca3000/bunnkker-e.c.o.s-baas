<?php

declare(strict_types=1);

namespace Modules\Manufacturing\AvailabilityEngine\Domain\Enums;

/**
 * Describes the manufacturing eligibility for a product given current inventory.
 *
 * Priority order (best → worst):
 *   Sufficient → CanManufacture → Partial → CannotManufacture → NoRecipe
 *
 * Callers use this to route to Decision Kernel rules:
 *   Sufficient      → no manufacturing action needed
 *   CanManufacture  → proceed to ManufacturingEngine
 *   Partial         → proceed with negative-stock risk (RC-2)
 *   CannotManufacture → escalate or defer
 *   NoRecipe        → reject or escalate
 */
enum ManufacturingEligibility: string
{
    /** Available finished goods cover the full required quantity. No manufacturing needed. */
    case Sufficient = 'sufficient';

    /** Manufacturing is needed and all raw material requirements are fully met. */
    case CanManufacture = 'can_manufacture';

    /**
     * Manufacturing is needed; some raw material quantities are short, but every
     * short component has allow_negative_stock = true (RC-2). Manufacturing can
     * proceed knowing those stock positions will go negative.
     */
    case Partial = 'partial';

    /**
     * Manufacturing is needed but at least one raw material is short and its
     * product does not allow negative stock. Manufacturing cannot proceed.
     */
    case CannotManufacture = 'cannot_manufacture';

    /** Manufacturing is needed but the product has no active Recipe. */
    case NoRecipe = 'no_recipe';

    public function label(): string
    {
        return match ($this) {
            self::Sufficient => 'Sufficient Stock',
            self::CanManufacture => 'Can Manufacture',
            self::Partial => 'Partial (Negative Stock Risk)',
            self::CannotManufacture => 'Cannot Manufacture',
            self::NoRecipe => 'No Active Recipe',
        };
    }

    /** True when manufacturing can proceed (possibly with negative stock risk). */
    public function allowsManufacturing(): bool
    {
        return $this === self::Sufficient
            || $this === self::CanManufacture
            || $this === self::Partial;
    }
}
