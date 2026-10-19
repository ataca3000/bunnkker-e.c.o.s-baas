<?php

declare(strict_types=1);

namespace Modules\POS\Application\Exceptions;

use App\Core\Exceptions\BusinessException;

final class CartNotReadyException extends BusinessException
{
    public static function notActive(string $cartId, string $status): self
    {
        return new self("Cart '{$cartId}' is not in a payable state (status: {$status}).", [], 422);
    }
}
