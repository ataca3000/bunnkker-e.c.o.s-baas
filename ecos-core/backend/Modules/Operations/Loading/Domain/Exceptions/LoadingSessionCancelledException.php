<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Exceptions;

use RuntimeException;

final class LoadingSessionCancelledException extends RuntimeException
{
    public static function forSession(string $sessionNumber): self
    {
        return new self("Loading session '{$sessionNumber}' is already cancelled or closed.");
    }
}
