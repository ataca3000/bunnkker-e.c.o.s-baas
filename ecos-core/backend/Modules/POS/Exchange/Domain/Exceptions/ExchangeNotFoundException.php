<?php

declare(strict_types=1);

namespace Modules\POS\Exchange\Domain\Exceptions;

use DomainException;

final class ExchangeNotFoundException extends DomainException
{
    public static function withId(string $id): self
    {
        return new self("Exchange with ID '{$id}' was not found.");
    }

    public static function withNumber(string $number): self
    {
        return new self("Exchange with number '{$number}' was not found.");
    }
}
