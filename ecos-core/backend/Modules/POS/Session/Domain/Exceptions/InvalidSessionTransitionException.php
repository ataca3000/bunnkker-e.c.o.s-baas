<?php

declare(strict_types=1);

namespace Modules\POS\Session\Domain\Exceptions;

use DomainException;
use Modules\POS\Shared\Domain\Enums\SessionStatus;

final class InvalidSessionTransitionException extends DomainException
{
    public static function cannotTransition(
        string $sessionId,
        SessionStatus $from,
        SessionStatus $to,
    ): self {
        return new self(sprintf(
            'Session "%s" cannot transition from "%s" to "%s".',
            $sessionId,
            $from->value,
            $to->value,
        ));
    }

    public static function alreadyInState(string $sessionId, SessionStatus $state): self
    {
        return new self(sprintf(
            'Session "%s" is already in state "%s".',
            $sessionId,
            $state->value,
        ));
    }
}
