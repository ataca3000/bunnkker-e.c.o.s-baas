<?php

declare(strict_types=1);

namespace Modules\POS\Customer\Domain\Exceptions;

use DomainException;
use Modules\POS\Shared\Domain\ValueObjects\Money;

final class InsufficientStoreCreditException extends DomainException
{
    public static function of(string $customerId, Money $requested, Money $available): self
    {
        return new self(
            "Customer '{$customerId}' requested {$requested->amount} {$requested->currency}"
            ." store credit but only {$available->amount} {$available->currency} is available.",
        );
    }
}
