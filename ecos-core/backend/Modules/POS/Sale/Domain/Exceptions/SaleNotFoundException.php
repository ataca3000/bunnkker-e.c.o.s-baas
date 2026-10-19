<?php

declare(strict_types=1);

namespace Modules\POS\Sale\Domain\Exceptions;

use DomainException;

final class SaleNotFoundException extends DomainException
{
    public static function withId(string $id): self
    {
        return new self("Sale with ID [{$id}] was not found.");
    }

    public static function forCart(string $cartId): self
    {
        return new self("No sale found for cart [{$cartId}].");
    }

    public static function forReceiptNumber(string $receiptNumber): self
    {
        return new self("No sale found with receipt number [{$receiptNumber}].");
    }
}
