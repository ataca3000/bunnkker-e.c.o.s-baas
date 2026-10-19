<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Enums;

/** Whether one scheduled recovery has been taken. */
enum InstallmentStatus: string
{
    case Scheduled = 'scheduled';
    case Recovered = 'recovered';
    case Waived = 'waived';
    case Cancelled = 'cancelled';

    /** Still owed — this is what the remaining balance is summed from. */
    public function isOutstanding(): bool
    {
        return $this === self::Scheduled;
    }

    public function label(): string
    {
        return ucfirst($this->value);
    }
}
