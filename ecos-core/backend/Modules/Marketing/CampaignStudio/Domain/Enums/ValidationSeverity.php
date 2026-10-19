<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Domain\Enums;

enum ValidationSeverity: string
{
    case BLOCKING = 'blocking';
    case WARNING = 'warning';
    case RECOMMENDATION = 'recommendation';

    public function label(): string
    {
        return match ($this) {
            self::BLOCKING => 'Blocking Error',
            self::WARNING => 'Warning',
            self::RECOMMENDATION => 'Recommendation',
        };
    }

    public function blocksPublishing(): bool
    {
        return $this === self::BLOCKING;
    }

    public function color(): string
    {
        return match ($this) {
            self::BLOCKING => 'red',
            self::WARNING => 'yellow',
            self::RECOMMENDATION => 'blue',
        };
    }
}
