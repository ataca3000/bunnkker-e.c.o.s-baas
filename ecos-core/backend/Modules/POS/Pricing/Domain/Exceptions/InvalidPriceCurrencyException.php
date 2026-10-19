<?php

declare(strict_types=1);

namespace Modules\POS\Pricing\Domain\Exceptions;

use InvalidArgumentException;

final class InvalidPriceCurrencyException extends InvalidArgumentException
{
    public static function empty(): self
    {
        return new self('Currency code cannot be empty.');
    }

    public static function malformed(string $currency): self
    {
        return new self(
            "Currency '{$currency}' is not a valid ISO 4217 format (expected 3 uppercase letters).",
        );
    }

    public static function unsupported(string $currency): self
    {
        return new self(
            "Currency '{$currency}' is not supported by this POS installation.",
        );
    }
}
