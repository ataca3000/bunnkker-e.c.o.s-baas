<?php

declare(strict_types=1);

namespace Modules\Purchasing\SupplierInvoices\Domain\Enums;

enum SupplierInvoiceStatus: string
{
    case Draft = 'draft';
    case Validated = 'validated';
    case AutoProcessing = 'auto_processing';
    case Posted = 'posted';
    case Failed = 'failed';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::Validated => 'Validated',
            self::AutoProcessing => 'Processing…',
            self::Posted => 'Posted',
            self::Failed => 'Failed',
            self::Cancelled => 'Cancelled',
        };
    }

    public function color(): string
    {
        return match ($this) {
            self::Draft => 'gray',
            self::Validated => 'blue',
            self::AutoProcessing => 'yellow',
            self::Posted => 'green',
            self::Failed => 'red',
            self::Cancelled => 'red',
        };
    }

    public function canPost(): bool
    {
        return $this === self::Validated;
    }

    public function canCancel(): bool
    {
        return in_array($this, [self::Draft, self::Validated, self::Failed]);
    }
}
