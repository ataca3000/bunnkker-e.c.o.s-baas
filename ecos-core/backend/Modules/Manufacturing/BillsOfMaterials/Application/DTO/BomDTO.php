<?php

declare(strict_types=1);

namespace Modules\Manufacturing\BillsOfMaterials\Application\DTO;

use App\Core\DTO\BaseDTO;

final class BomDTO extends BaseDTO
{
    /**
     * @param  list<BomLineDTO>|null  $lines  NULL means "leave the existing lines
     *                                        alone"; an empty array means "delete
     *                                        every line". Conflating the two is
     *                                        what allowed BUG-BOM-DATA-LOSS-001:
     *                                        a caller that simply omitted `lines`
     *                                        silently wiped the recipe.
     */
    public function __construct(
        public readonly string $product_id,
        public readonly string $version,
        public readonly bool $is_active,
        public readonly ?string $notes,
        public readonly float $manufacturing_cost,
        public readonly float $other_costs,
        public readonly float $yield_quantity,
        public readonly ?string $execution_instructions,
        public readonly ?array $lines,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data): self
    {
        // Absent key -> null (leave lines untouched). Present -> map it, so an
        // explicit [] still means "delete every line".
        $lines = array_key_exists('lines', $data) && is_array($data['lines'])
            ? array_values(array_map(
                fn (mixed $line): BomLineDTO => BomLineDTO::fromArray((array) $line),
                $data['lines'],
            ))
            : null;

        return new self(
            product_id: (string) $data['product_id'],
            version: (string) ($data['version'] ?? '1.0'),
            is_active: (bool) ($data['is_active'] ?? false),
            notes: isset($data['notes']) && $data['notes'] !== '' ? (string) $data['notes'] : null,
            manufacturing_cost: (float) ($data['manufacturing_cost'] ?? 0),
            other_costs: (float) ($data['other_costs'] ?? 0),
            yield_quantity: (float) ($data['yield_quantity'] ?? 1.0),
            execution_instructions: isset($data['execution_instructions']) && $data['execution_instructions'] !== ''
                ? (string) $data['execution_instructions']
                : null,
            lines: $lines,
        );
    }
}
