<?php

declare(strict_types=1);

namespace Modules\POS\Customer\Domain\Exceptions;

use DomainException;

final class InsufficientLoyaltyPointsException extends DomainException
{
    public static function of(string $customerId, int $requested, int $available): self
    {
        return new self(
            "Customer '{$customerId}' requested {$requested} loyalty points"
            ." but only {$available} are available.",
        );
    }
}
