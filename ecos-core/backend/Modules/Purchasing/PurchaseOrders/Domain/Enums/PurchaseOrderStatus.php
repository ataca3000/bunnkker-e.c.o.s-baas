<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseOrders\Domain\Enums;

enum PurchaseOrderStatus: string
{
    case Draft = 'draft';
    case Submitted = 'submitted';
    case Approved = 'approved';
    case PartiallyReceived = 'partially_received';
    case Received = 'received';
    case Closed = 'closed';
    case Cancelled = 'cancelled';

    public function isEditable(): bool
    {
        return $this === self::Draft;
    }

    public function canSubmit(): bool
    {
        return $this === self::Draft;
    }

    public function canApprove(): bool
    {
        return $this === self::Submitted;
    }

    public function canReceive(): bool
    {
        return in_array($this, [self::Approved, self::PartiallyReceived], true);
    }

    public function canCancel(): bool
    {
        return in_array($this, [self::Draft, self::Submitted], true);
    }

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::Submitted => 'Submitted',
            self::Approved => 'Approved',
            self::PartiallyReceived => 'Partially Received',
            self::Received => 'Received',
            self::Closed => 'Closed',
            self::Cancelled => 'Cancelled',
        };
    }
}
