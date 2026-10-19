<?php

declare(strict_types=1);

namespace Modules\POS\CashDrawer\Domain\Exceptions;

use DomainException;

final class CashDrawerNotFoundException extends DomainException
{
    public static function withId(string $id): self
    {
        return new self("Cash drawer with ID '{$id}' was not found.");
    }

    public static function forShift(string $shiftId): self
    {
        return new self("Cash drawer for shift '{$shiftId}' was not found.");
    }

    public static function forSession(string $sessionId): self
    {
        return new self("Cash drawer for session '{$sessionId}' was not found.");
    }
}
