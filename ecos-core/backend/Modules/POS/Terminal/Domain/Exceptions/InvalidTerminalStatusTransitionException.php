<?php

declare(strict_types=1);

namespace Modules\POS\Terminal\Domain\Exceptions;

use DomainException;
use Modules\POS\Terminal\Domain\Enums\TerminalStatus;

final class InvalidTerminalStatusTransitionException extends DomainException
{
    public static function cannotTransition(
        string $terminalId,
        TerminalStatus $from,
        TerminalStatus $to,
    ): self {
        return new self(sprintf(
            'Terminal "%s" cannot transition from "%s" to "%s".',
            $terminalId,
            $from->value,
            $to->value,
        ));
    }

    public static function alreadyInState(string $terminalId, TerminalStatus $state): self
    {
        return new self(sprintf(
            'Terminal "%s" is already in state "%s".',
            $terminalId,
            $state->value,
        ));
    }
}
