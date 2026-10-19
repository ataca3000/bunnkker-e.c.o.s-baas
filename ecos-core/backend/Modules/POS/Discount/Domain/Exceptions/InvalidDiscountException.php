<?php

declare(strict_types=1);

namespace Modules\POS\Discount\Domain\Exceptions;

use DomainException;
use Modules\POS\Discount\Domain\Enums\DiscountStatus;

final class InvalidDiscountException extends DomainException
{
    public static function emptyCashierId(): self
    {
        return new self('Cashier ID cannot be empty.');
    }

    public static function exceedsPercentageLimit(string $requested, string $max): self
    {
        return new self(
            "Requested discount {$requested}% exceeds the allowed maximum of {$max}%.",
        );
    }

    public static function exceedsFixedAmountLimit(string $requested, string $max): self
    {
        return new self(
            "Requested discount amount {$requested} exceeds the allowed maximum of {$max}.",
        );
    }

    public static function notPending(string $discountId, DiscountStatus $current): self
    {
        return new self(
            "Discount [{$discountId}] cannot be approved or rejected — current status is {$current->value}.",
        );
    }

    public static function notApproved(string $discountId): self
    {
        return new self(
            "Cannot compute amount for discount [{$discountId}] — it has not been approved.",
        );
    }

    public static function invalidSupervisor(): self
    {
        return new self('Supervisor ID cannot be empty.');
    }

    public static function rejectionReasonRequired(): self
    {
        return new self('A rejection reason must be provided when rejecting a discount.');
    }
}
