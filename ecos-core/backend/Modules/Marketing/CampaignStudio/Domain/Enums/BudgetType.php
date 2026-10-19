<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Domain\Enums;

enum BudgetType: string
{
    case DAILY = 'daily';
    case LIFETIME = 'lifetime';

    public function label(): string
    {
        return match ($this) {
            self::DAILY => 'Daily Budget',
            self::LIFETIME => 'Lifetime Budget',
        };
    }
}
