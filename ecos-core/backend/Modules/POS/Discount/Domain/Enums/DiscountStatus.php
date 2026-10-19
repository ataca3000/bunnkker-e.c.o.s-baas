<?php

declare(strict_types=1);

namespace Modules\POS\Discount\Domain\Enums;

enum DiscountStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';

    public function isTerminal(): bool
    {
        return $this !== self::Pending;
    }

    public function canBeApproved(): bool
    {
        return $this === self::Pending;
    }

    public function canBeRejected(): bool
    {
        return $this === self::Pending;
    }
}
