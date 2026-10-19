<?php

declare(strict_types=1);

namespace Modules\CostManagement\Domain\Enums;

enum PricingReviewStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Kept = 'kept';
    case CustomPrice = 'custom_price';
    case Snoozed = 'snoozed';
    case Rejected = 'rejected';

    public function isResolved(): bool
    {
        return match ($this) {
            self::Approved, self::Kept, self::CustomPrice, self::Rejected => true,
            default => false,
        };
    }
}
