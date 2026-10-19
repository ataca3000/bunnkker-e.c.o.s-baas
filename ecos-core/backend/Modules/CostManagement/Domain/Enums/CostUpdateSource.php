<?php

declare(strict_types=1);

namespace Modules\CostManagement\Domain\Enums;

enum CostUpdateSource: string
{
    case Manual = 'manual';
    case PurchaseInvoice = 'purchase_invoice';

    public function label(): string
    {
        return match ($this) {
            self::Manual => 'Manual Edit',
            self::PurchaseInvoice => 'Purchase Invoice',
        };
    }
}
