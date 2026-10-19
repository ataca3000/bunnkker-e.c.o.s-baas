<?php

declare(strict_types=1);

namespace Modules\POS\Shared\Domain\Exceptions;

use InvalidArgumentException;

final class InvalidMoneyOperationException extends InvalidArgumentException
{
    public static function currencyMismatch(string $left, string $right): self
    {
        return new self(
            "Cannot operate on money values with different currencies: {$left} vs {$right}.",
        );
    }

    public static function divisionByZero(): self
    {
        return new self('Cannot divide a Money value by zero.');
    }

    public static function invalidParts(int $parts): self
    {
        return new self("Parts must be a positive integer, got: {$parts}.");
    }
}
