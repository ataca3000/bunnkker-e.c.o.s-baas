<?php

declare(strict_types=1);

namespace Modules\Purchasing\SupplierReturns\Domain\Enums;

enum SupplierReturnStatus: string
{
    case Draft = 'draft';
    case WaitingApproval = 'waiting_approval';
    case Approved = 'approved';
    case Sent = 'sent';
    case CreditPending = 'credit_pending';
    case Completed = 'completed';
    case Cancelled = 'cancelled';
    case Rejected = 'rejected';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::WaitingApproval => 'Waiting Approval',
            self::Approved => 'Approved',
            self::Sent => 'Sent to Supplier',
            self::CreditPending => 'Credit Pending',
            self::Completed => 'Completed',
            self::Cancelled => 'Cancelled',
            self::Rejected => 'Rejected',
        };
    }

    public function color(): string
    {
        return match ($this) {
            self::Draft => 'gray',
            self::WaitingApproval => 'yellow',
            self::Approved => 'blue',
            self::Sent => 'purple',
            self::CreditPending => 'orange',
            self::Completed => 'green',
            self::Cancelled => 'red',
            self::Rejected => 'red',
        };
    }

    public function canTransitionTo(self $next): bool
    {
        return match ($this) {
            self::Draft => in_array($next, [self::WaitingApproval, self::Cancelled]),
            self::WaitingApproval => in_array($next, [self::Approved, self::Rejected, self::Cancelled]),
            self::Approved => in_array($next, [self::Sent, self::Cancelled]),
            self::Sent => in_array($next, [self::CreditPending]),
            self::CreditPending => in_array($next, [self::Completed]),
            default => false,
        };
    }
}
