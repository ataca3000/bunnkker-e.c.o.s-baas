<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Domain\Enums;

enum PlacementMode: string
{
    case AUTO = 'auto';
    case MANUAL = 'manual';

    public function label(): string
    {
        return match ($this) {
            self::AUTO => 'Automatic Placements',
            self::MANUAL => 'Manual Placements',
        };
    }
}
