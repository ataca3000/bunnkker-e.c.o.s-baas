<?php

declare(strict_types=1);

namespace Modules\Inventory\Products\Domain\Enums;

enum CostSource: string
{
    case Purchase = 'purchase';
    case Recipe = 'recipe';
    case Hybrid = 'hybrid';

    public function label(): string
    {
        return match ($this) {
            self::Purchase => 'Purchase (GR)',
            self::Recipe => 'Recipe (Manufacturing)',
            self::Hybrid => 'Hybrid (Purchase + Recipe)',
        };
    }

    public function isManufacturingRelevant(): bool
    {
        return $this !== self::Purchase;
    }
}
