<?php

declare(strict_types=1);

namespace Modules\Inventory\ReceiptLayers\Application\DTO;

final class ConsumptionResult
{
    /** @param list<ConsumedLayerDTO> $consumedLayers */
    public function __construct(
        public readonly float $totalQuantity,
        public readonly float $totalCost,
        public readonly float $weightedCost,
        public readonly array $consumedLayers,
    ) {}
}
