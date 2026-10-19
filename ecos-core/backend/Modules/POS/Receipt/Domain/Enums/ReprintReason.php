<?php

declare(strict_types=1);

namespace Modules\POS\Receipt\Domain\Enums;

enum ReprintReason: string
{
    case CustomerRequest = 'customer_request';
    case PrinterError = 'printer_error';
    case Damaged = 'damaged';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::CustomerRequest => 'Customer Request',
            self::PrinterError => 'Printer Error',
            self::Damaged => 'Damaged',
            self::Other => 'Other',
        };
    }
}
