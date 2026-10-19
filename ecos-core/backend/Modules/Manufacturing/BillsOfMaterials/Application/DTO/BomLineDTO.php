<?php

declare(strict_types=1);

namespace Modules\Manufacturing\BillsOfMaterials\Application\DTO;

use App\Core\DTO\BaseDTO;

final class BomLineDTO extends BaseDTO
{
    public function __construct(
        public readonly string $raw_material_id,
        public readonly float $quantity,
        public readonly float $waste_percentage = 0.0,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data): self
    {
        return new self(
            raw_material_id: (string) $data['raw_material_id'],
            quantity: (float) ($data['quantity'] ?? 1),
            waste_percentage: (float) ($data['waste_percentage'] ?? 0),
        );
    }
}
