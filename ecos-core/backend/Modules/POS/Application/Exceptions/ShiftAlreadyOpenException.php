<?php

declare(strict_types=1);

namespace Modules\POS\Application\Exceptions;

use App\Core\Exceptions\BusinessException;

final class ShiftAlreadyOpenException extends BusinessException
{
    public static function forSession(string $sessionId): self
    {
        return new self("Session '{$sessionId}' already has an open shift.", [], 409);
    }
}
