<?php

declare(strict_types=1);

namespace Modules\POS\Payment\Domain\Exceptions;

use DomainException;
use Modules\POS\Shared\Domain\ValueObjects\Money;

final class InsufficientPaymentException extends DomainException
{
    public static function forCapture(string $paymentId, Money $required, Money $tendered): self
    {
        return new self(
            "Payment [{$paymentId}] cannot be captured: ".
            "required {$required->amount} {$required->currency} ".
            "but only {$tendered->amount} {$tendered->currency} tendered.",
        );
    }
}
