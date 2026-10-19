<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Enums;

/** What kind of bonus this is. */
enum BonusType: string
{
    case Performance = 'performance';
    case Discretionary = 'discretionary';
    case Spot = 'spot';
    case CommissionAdjustment = 'commission_adjustment';

    public function label(): string
    {
        return match ($this) {
            self::Performance => 'Performance Bonus',
            self::Discretionary => 'Discretionary Bonus',
            self::Spot => 'Spot Award',
            self::CommissionAdjustment => 'Commission Adjustment',
        };
    }
}
