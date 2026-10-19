<?php

declare(strict_types=1);

namespace Modules\POS\Cart\Domain\Exceptions;

use DomainException;

final class CartNotFoundException extends DomainException
{
    public static function withId(string $id): self
    {
        return new self("Cart with ID [{$id}] not found.");
    }
}
