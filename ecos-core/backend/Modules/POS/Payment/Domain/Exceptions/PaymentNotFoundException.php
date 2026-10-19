<?php

declare(strict_types=1);

namespace Modules\POS\Payment\Domain\Exceptions;

use DomainException;

final class PaymentNotFoundException extends DomainException
{
    public static function withId(string $id): self
    {
        return new self("Payment with ID [{$id}] was not found.");
    }

    public static function forCart(string $cartId): self
    {
        return new self("No payment found for cart [{$cartId}].");
    }
}
