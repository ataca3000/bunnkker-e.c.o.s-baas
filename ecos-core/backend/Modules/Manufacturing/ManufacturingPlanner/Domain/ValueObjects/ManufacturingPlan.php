<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingPlanner\Domain\ValueObjects;

use Modules\Manufacturing\AvailabilityEngine\Domain\Enums\ManufacturingEligibility;
use Modules\Manufacturing\BillsOfMaterials\Domain\ValueObjects\RecipeSnapshot;
use Modules\Manufacturing\DecisionKernel\Domain\Enums\DecisionType;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionReason;

/**
 * Immutable output of the ManufacturingPlanner.
 *
 * Encodes everything needed to execute (or reject) a manufacturing run.
 *
 * READ + PLAN ONLY: no inventory has been touched, no jobs dispatched.
 * The Manufacturing Engine (PKG-05) consumes this plan and executes it.
 *
 * Key flags:
 *   can_proceed       — eligibility allows manufacturing AND decision is positive
 *   should_manufacture — can_proceed AND manufacturing is actually needed (qty > 0)
 *
 * Recipe integrity:
 *   recipe_snapshot_hash — SHA-256 of RecipeSnapshot.toArray() at planning time.
 *   The Manufacturing Engine verifies this hash before consuming any stock.
 *
 * @property list<ComponentConsumptionPlan> $components
 * @property list<NegativeStockDecision> $negative_stock_decisions
 */
final readonly class ManufacturingPlan
{
    /**
     * @param  list<ComponentConsumptionPlan>  $components
     * @param  list<NegativeStockDecision>  $negative_stock_decisions
     */
    public function __construct(
        /** UUID v4 generated at planning time. */
        public string $plan_id,

        public string $product_id,
        public string $warehouse_id,

        /** From RecipeSnapshot. Null when eligibility is Sufficient or NoRecipe. */
        public ?string $product_sku,
        public ?string $product_name,

        /** Quantity that must be manufactured (RC-1: max(0, required − available_fg)). */
        public float $qty_to_manufacture,

        /** = qty_to_manufacture. Alias that answers "how many units will be produced." */
        public float $finished_goods_to_produce,

        /** Finished goods already at the warehouse (available before manufacturing). */
        public float $available_finished_goods,

        /** From RecipeSnapshot. Null when no recipe applies. */
        public ?string $recipe_id,

        /** For RC-10 unique constraint on manufacturing_transactions. Null when no recipe. */
        public ?int $bom_version_number,

        /**
         * The RecipeSnapshot used during planning.
         * Null when no recipe applies (Sufficient / NoRecipe).
         * The Manufacturing Executor re-hashes this to verify integrity before executing.
         */
        public ?RecipeSnapshot $recipe_snapshot,

        /**
         * SHA-256 of RecipeSnapshot.toArray() encoded as JSON.
         * The Manufacturing Executor verifies this against recipe_snapshot before executing.
         * Null when no recipe (Sufficient / NoRecipe).
         */
        public ?string $recipe_snapshot_hash,

        /** Per-component consumption intentions. Empty when no manufacturing needed. */
        public array $components,

        /** Components that will push stock below zero (RC-2 accepted risk). */
        public array $negative_stock_decisions,

        public ManufacturingEligibility $eligibility,

        /**
         * True when:
         *   - eligibility allows manufacturing (Sufficient|CanManufacture|Partial), AND
         *   - decision type is positive (Approve|Partial)
         */
        public bool $can_proceed,

        /**
         * True when can_proceed = true AND manufacturing is actually needed.
         * False for Sufficient (stock already covers the need).
         * The Manufacturing Engine must check this before executing.
         */
        public bool $should_manufacture,

        public DecisionType $decision_type,
        public DecisionReason $decision_reason,

        /** ISO 8601 timestamp of when the plan was built. */
        public string $planned_at,

        /**
         * Merged metadata: trigger info + warehouse_id + decided_at + caller-provided.
         * Preserved here for the Manufacturing Engine's audit trail.
         */
        public array $metadata,
    ) {}

    /** True if any component will go below zero stock. */
    public function hasNegativeStockRisk(): bool
    {
        return $this->negative_stock_decisions !== [];
    }

    /** @return list<ComponentConsumptionPlan> */
    public function blockedComponents(): array
    {
        return array_values(
            array_filter(
                $this->components,
                fn (ComponentConsumptionPlan $c): bool => $c->is_blocked,
            ),
        );
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'plan_id' => $this->plan_id,
            'product_id' => $this->product_id,
            'warehouse_id' => $this->warehouse_id,
            'product_sku' => $this->product_sku,
            'product_name' => $this->product_name,
            'qty_to_manufacture' => $this->qty_to_manufacture,
            'finished_goods_to_produce' => $this->finished_goods_to_produce,
            'available_finished_goods' => $this->available_finished_goods,
            'recipe_id' => $this->recipe_id,
            'bom_version_number' => $this->bom_version_number,
            'recipe_snapshot' => $this->recipe_snapshot?->toArray(),
            'recipe_snapshot_hash' => $this->recipe_snapshot_hash,
            'components' => array_map(
                fn (ComponentConsumptionPlan $c): array => $c->toArray(),
                $this->components,
            ),
            'negative_stock_decisions' => array_map(
                fn (NegativeStockDecision $d): array => $d->toArray(),
                $this->negative_stock_decisions,
            ),
            'eligibility' => $this->eligibility->value,
            'can_proceed' => $this->can_proceed,
            'should_manufacture' => $this->should_manufacture,
            'decision_type' => $this->decision_type->value,
            'decision_reason' => $this->decision_reason->toArray(),
            'planned_at' => $this->planned_at,
            'metadata' => $this->metadata,
        ];
    }
}
