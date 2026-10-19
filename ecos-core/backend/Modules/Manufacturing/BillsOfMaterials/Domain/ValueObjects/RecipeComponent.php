<?php

declare(strict_types=1);

namespace Modules\Manufacturing\BillsOfMaterials\Domain\ValueObjects;

/**
 * An immutable snapshot of one component in a resolved Recipe.
 *
 * Unit comes from the component Product's unit relationship (never a separate
 * line-level unit). This enforces the architecture rule: "Unit comes from Product."
 *
 * allow_negative_stock is forwarded from Product so the Decision Engine can
 * apply rule MFG-007/MFG-008 (RC-2) without touching the DB again.
 */
final readonly class RecipeComponent
{
    public function __construct(
        /** UUID of the component Product. */
        public string $component_id,

        public string $sku,
        public string $name,

        /** From component Product → unit relationship. */
        public string $unit_id,
        public string $unit_name,
        public string $unit_symbol,

        /**
         * Absolute quantity of this component required to produce one unit of output.
         * The caller scales by shortage_qty (RC-1) at manufacturing execution time.
         */
        public float $quantity,

        /**
         * Forwarded from Product.allow_negative_stock (RC-2).
         * Decision Engine uses this to choose MFG-007 vs MFG-008.
         */
        public bool $allow_negative_stock,
    ) {}

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'component_id' => $this->component_id,
            'sku' => $this->sku,
            'name' => $this->name,
            'unit_id' => $this->unit_id,
            'unit_name' => $this->unit_name,
            'unit_symbol' => $this->unit_symbol,
            'quantity' => $this->quantity,
            'allow_negative_stock' => $this->allow_negative_stock,
        ];
    }
}
