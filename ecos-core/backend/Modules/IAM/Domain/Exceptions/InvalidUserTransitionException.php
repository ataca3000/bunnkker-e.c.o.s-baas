<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\Exceptions;

use Modules\IAM\Domain\Enums\UserStatus;
use RuntimeException;

/**
 * Raised when a user lifecycle transition is not permitted by the state machine (ADR-040).
 */
final class InvalidUserTransitionException extends RuntimeException
{
    public static function between(UserStatus $from, UserStatus $to): self
    {
        return new self("Cannot transition user from '{$from->value}' to '{$to->value}'.");
    }
}
