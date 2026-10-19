<?php

declare(strict_types=1);

namespace Modules\POS\Discount\Domain\Exceptions;

use DomainException;

final class DiscountNotFoundException extends DomainException
{
    public static function withId(string $id): self
    {
        return new self("Discount [{$id}] not found.");
    }
}
