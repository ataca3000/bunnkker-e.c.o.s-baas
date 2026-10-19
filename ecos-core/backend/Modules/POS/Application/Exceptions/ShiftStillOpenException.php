<?php

declare(strict_types=1);

namespace Modules\POS\Application\Exceptions;

use App\Core\Exceptions\BusinessException;

final class ShiftStillOpenException extends BusinessException
{
    public static function forSession(string $sessionId): self
    {
        return new self(
            "Session '{$sessionId}' has an open shift that must be closed before the session can be closed.",
            [],
            422,
        );
    }
}
