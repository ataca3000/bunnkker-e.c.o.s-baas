<?php

declare(strict_types=1);

namespace Modules\Manufacturing\AvailabilityEngine\Domain\ValueObjects;

/**
 * Availability analysis for one raw material component.
 *
 * `required_qty` is already scaled by `qty_to_manufacture` — it represents
 * the absolute quantity of this component needed to fulfil the manufacturing run,
 * not the per-unit recipe quantity.
 *
 * `is_satisfied` = true when:
 *   - available_qty >= required_qty (stock covers the need), OR
 *   - allow_negative_stock = true (RC-2: going negative is permitted for this component)
 *
 * The Decision Engine uses `allow_negative_stock` to select MFG-007 vs MFG-008.
 */
final readonly class RawMaterialAvailability
{
    public function __construct(
        public string $component_id,
        public string $sku,
        public string $name,
        public string $unit_symbol,

        /** Quantity required for the manufacturing run (component.quantity × qty_to_manufacture). */
        public float $required_qty,

        /** Quantity currently available at the target warehouse. */
        public float $available_qty,

        /** max(0, required_qty − available_qty). Zero means fully covered. */
        public float $missing_qty,

        /** Forwarded from Product.allow_negative_stock (RC-2). */
        public bool $allow_negative_stock,

        /** True when the requirement is met — either in stock or negative stock is permitted. */
        public bool $is_satisfied,
    ) {}

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'component_id' => $this->component_id,
            'sku' => $this->sku,
            'name' => $this->name,
            'unit_symbol' => $this->unit_symbol,
            'required_qty' => $this->required_qty,
            'available_qty' => $this->available_qty,
            'missing_qty' => $this->missing_qty,
            'allow_negative_stock' => $this->allow_negative_stock,
            'is_satisfied' => $this->is_satisfied,
        ];
    }
}
