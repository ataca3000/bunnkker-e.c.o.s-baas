<?php

declare(strict_types=1);

namespace Modules\POS\Shift\Domain\Exceptions;

use DomainException;
use Modules\POS\Shared\Domain\Enums\ShiftStatus;

final class InvalidShiftTransitionException extends DomainException
{
    public static function cannotTransition(
        string $shiftId,
        ShiftStatus $from,
        ShiftStatus $to,
    ): self {
        return new self(sprintf(
            'Shift "%s" cannot transition from "%s" to "%s".',
            $shiftId,
            $from->value,
            $to->value,
        ));
    }

    public static function alreadyInState(string $shiftId, ShiftStatus $state): self
    {
        return new self(sprintf(
            'Shift "%s" is already in state "%s".',
            $shiftId,
            $state->value,
        ));
    }

    public static function noClosingCount(string $shiftId): self
    {
        return new self(sprintf(
            'Shift "%s" has no submitted closing count.',
            $shiftId,
        ));
    }

    public static function currencyMismatch(string $shiftId, string $expected, string $actual): self
    {
        return new self(sprintf(
            'Currency mismatch in shift "%s": shift uses "%s" but received "%s".',
            $shiftId,
            $expected,
            $actual,
        ));
    }
}
