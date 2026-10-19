<?php

declare(strict_types=1);

namespace Modules\POS\Payment\Domain\Exceptions;

use DomainException;
use Modules\POS\Payment\Domain\Enums\PaymentStatus;

final class InvalidPaymentStateException extends DomainException
{
    public static function alreadyCaptured(string $paymentId): self
    {
        return new self("Payment [{$paymentId}] has already been captured.");
    }

    public static function cannotModifyTenders(string $paymentId, PaymentStatus $status): self
    {
        return new self(
            "Payment [{$paymentId}] is in \"{$status->value}\" state — tenders cannot be modified.",
        );
    }

    public static function tenderNotFound(string $paymentId, string $tenderId): self
    {
        return new self("Payment [{$paymentId}] has no tender with ID [{$tenderId}].");
    }
}
