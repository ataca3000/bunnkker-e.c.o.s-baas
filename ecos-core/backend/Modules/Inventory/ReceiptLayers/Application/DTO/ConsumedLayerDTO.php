<?php

declare(strict_types=1);

namespace Modules\Inventory\ReceiptLayers\Application\DTO;

final class ConsumedLayerDTO
{
    public function __construct(
        public readonly string $layerId,
        public readonly float $quantity,
        public readonly float $unitCost,
        public readonly float $totalCost,
    ) {}
}
