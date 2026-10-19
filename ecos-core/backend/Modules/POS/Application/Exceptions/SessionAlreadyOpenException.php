<?php

declare(strict_types=1);

namespace Modules\POS\Application\Exceptions;

use App\Core\Exceptions\BusinessException;

final class SessionAlreadyOpenException extends BusinessException
{
    public static function forCashier(string $cashierId): self
    {
        return new self("Cashier '{$cashierId}' already has an open session.", [], 409);
    }

    /** @deprecated Use forCashier() — terminal IDs are no longer used. */
    public static function forTerminal(string $terminalId): self
    {
        return self::forCashier($terminalId);
    }
}
