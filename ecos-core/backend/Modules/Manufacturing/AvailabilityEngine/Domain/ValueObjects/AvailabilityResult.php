<?php

declare(strict_types=1);

namespace Modules\Manufacturing\AvailabilityEngine\Domain\ValueObjects;

use Modules\Manufacturing\AvailabilityEngine\Domain\Enums\ManufacturingEligibility;
use Modules\Manufacturing\BillsOfMaterials\Domain\ValueObjects\RecipeSnapshot;

/**
 * Immutable output of the Inventory Availability Engine.
 *
 * Contains everything the caller needs to decide the next action:
 *   - How much finished goods are already in stock
 *   - How much needs to be manufactured
 *   - Which recipe will be used and at which version
 *   - Per-component material requirements and gaps
 *   - Whether manufacturing can proceed (and at what risk level)
 *
 * No inventory was touched to produce this result.
 * No manufacturing was started.
 * No reservations were made.
 */
final readonly class AvailabilityResult
{
    /**
     * @param  list<RawMaterialAvailability>  $raw_materials
     */
    public function __construct(
        public string $product_id,
        public string $warehouse_id,

        /** Quantity the caller originally requested. */
        public float $required_qty,

        /** Finished goods available at the warehouse (on_hand − reserved). */
        public float $available_finished_goods,

        /**
         * Quantity that must be manufactured.
         * = max(0, required_qty − available_finished_goods)  [RC-1]
         */
        public float $qty_to_manufacture,

        /** True when qty_to_manufacture > 0. */
        public bool $needs_manufacturing,

        /**
         * The resolved recipe used for material analysis.
         * Null when no manufacturing is needed or no active recipe exists.
         */
        public ?RecipeSnapshot $recipe_snapshot,

        /**
         * Per-component availability analysis.
         * Empty when needs_manufacturing = false or no recipe found.
         */
        public array $raw_materials,

        /**
         * Shorthand: manufacturing can proceed without hard blockers.
         * True for: Sufficient, CanManufacture, Partial.
         * False for: CannotManufacture, NoRecipe.
         */
        public bool $can_manufacture,

        /** Full eligibility classification for Decision Kernel rule selection. */
        public ManufacturingEligibility $eligibility,

        /** ISO 8601 timestamp of when this analysis was performed. */
        public string $evaluated_at,
    ) {}

    public function isSufficient(): bool
    {
        return $this->eligibility === ManufacturingEligibility::Sufficient;
    }

    public function hasRecipe(): bool
    {
        return $this->recipe_snapshot !== null;
    }

    /** @return list<RawMaterialAvailability> */
    public function missingMaterials(): array
    {
        return array_values(
            array_filter($this->raw_materials, fn (RawMaterialAvailability $m): bool => $m->missing_qty > 0.0),
        );
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'product_id' => $this->product_id,
            'warehouse_id' => $this->warehouse_id,
            'required_qty' => $this->required_qty,
            'available_finished_goods' => $this->available_finished_goods,
            'qty_to_manufacture' => $this->qty_to_manufacture,
            'needs_manufacturing' => $this->needs_manufacturing,
            'recipe_snapshot' => $this->recipe_snapshot?->toArray(),
            'raw_materials' => array_map(
                fn (RawMaterialAvailability $m): array => $m->toArray(),
                $this->raw_materials,
            ),
            'can_manufacture' => $this->can_manufacture,
            'eligibility' => $this->eligibility->value,
            'evaluated_at' => $this->evaluated_at,
        ];
    }
}
