<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Enums;

enum AllocationRecordStatus: string
{
    case Allocated = 'allocated';
    case Confirmed = 'confirmed';
    case InDelivery = 'in_delivery';
    case Delivered = 'delivered';
    case PartialDelivery = 'partial_delivery';
    case Failed = 'failed';
    case Cancelled = 'cancelled';

    public function canTransitionTo(self $next): bool
    {
        return match ($this) {
            self::Allocated => in_array($next, [self::Confirmed, self::Cancelled], true),
            self::Confirmed => in_array($next, [self::InDelivery, self::Cancelled], true),
            self::InDelivery => in_array($next, [self::Delivered, self::PartialDelivery, self::Failed], true),
            self::PartialDelivery => in_array($next, [self::Delivered, self::Failed], true),
            self::Delivered, self::Failed, self::Cancelled => false,
        };
    }

    public function isTerminal(): bool
    {
        return in_array($this, [self::Delivered, self::Failed, self::Cancelled], true);
    }

    public function isActive(): bool
    {
        return ! $this->isTerminal();
    }
}
