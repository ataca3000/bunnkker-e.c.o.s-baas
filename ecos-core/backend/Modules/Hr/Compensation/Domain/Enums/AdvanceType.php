<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Enums;

/** Whether an advance is recovered in one go or over several periods. */
enum AdvanceType: string
{
    case OneTime = 'one_time';
    case Installment = 'installment';

    public function defaultInstallments(): int
    {
        return $this === self::OneTime ? 1 : 0;   // 0 = the caller must state how many
    }

    public function label(): string
    {
        return $this === self::OneTime ? 'One-Time Advance' : 'Installment Advance';
    }
}
