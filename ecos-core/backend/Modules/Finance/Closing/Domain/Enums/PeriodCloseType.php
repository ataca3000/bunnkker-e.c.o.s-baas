<?php

declare(strict_types=1);

namespace Modules\Finance\Closing\Domain\Enums;

/**
 * How a period is closed.
 *
 *   soft — reversible; the period is closed to routine posting but an authorised
 *          controller may reopen it for late adjustments (maps to F1 "closed").
 *   hard — permanent; the period is locked and can never accept a posting again
 *          (maps to F1 "locked"). A hard close requires a prior soft close.
 */
enum PeriodCloseType: string
{
    case Soft = 'soft';
    case Hard = 'hard';

    public function isHard(): bool
    {
        return $this === self::Hard;
    }
}
