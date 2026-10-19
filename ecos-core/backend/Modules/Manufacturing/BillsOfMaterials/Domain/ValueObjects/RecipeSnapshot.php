<?php

declare(strict_types=1);

namespace Modules\Manufacturing\BillsOfMaterials\Domain\ValueObjects;

/**
 * Immutable snapshot of a Recipe at the moment of resolution.
 *
 * Captures everything needed to execute manufacturing without hitting the DB again:
 *   - Which recipe version was active at resolution time (bom_version_number → RC-10).
 *   - The output product identity.
 *   - All components with their units and negative-stock flags (RC-2).
 *
 * Consumers: Manufacturing Engine, Decision Engine, Cost Engine, Simulation Engine, AI Engine.
 * All recipe execution MUST go through RecipeResolver to obtain this snapshot.
 *
 * @property list<RecipeComponent> $components
 */
final readonly class RecipeSnapshot
{
    /**
     * @param  list<RecipeComponent>  $components
     */
    public function __construct(
        /** UUID of the Recipe (bills_of_materials row). */
        public string $recipe_id,

        public string $bom_number,

        /** Display version label (e.g. "1.0", "2.1"). */
        public string $version,

        /**
         * Monotonically increasing integer version — used in the unique constraint
         * on manufacturing_transactions (RC-10):
         * UNIQUE (order_line_id, bom_id, bom_version_number) WHERE status != 'failed'.
         */
        public int $bom_version_number,

        /** UUID of the output (finished goods) Product. */
        public string $product_id,
        public string $product_sku,
        public string $product_name,

        /** Resolved and validated components. Never empty. */
        public array $components,

        /** ISO 8601 timestamp of when this snapshot was produced. */
        public string $resolved_at,
    ) {}

    public function componentCount(): int
    {
        return count($this->components);
    }

    public function hasComponents(): bool
    {
        return $this->components !== [];
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'recipe_id' => $this->recipe_id,
            'bom_number' => $this->bom_number,
            'version' => $this->version,
            'bom_version_number' => $this->bom_version_number,
            'product_id' => $this->product_id,
            'product_sku' => $this->product_sku,
            'product_name' => $this->product_name,
            'components' => array_map(
                fn (RecipeComponent $c): array => $c->toArray(),
                $this->components,
            ),
            'resolved_at' => $this->resolved_at,
        ];
    }
}
