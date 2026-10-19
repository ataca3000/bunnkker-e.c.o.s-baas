<?php

declare(strict_types=1);

namespace Modules\Inventory\StockLedger\Domain\Enums;

enum MovementType: string
{
    case PurchaseReceipt = 'purchase_receipt';
    case SalesIssue = 'sales_issue';
    case AdjustmentIn = 'adjustment_in';
    case AdjustmentOut = 'adjustment_out';
    case TransferIn = 'transfer_in';
    case TransferOut = 'transfer_out';

    public function label(): string
    {
        return match ($this) {
            self::PurchaseReceipt => 'Purchase Receipt',
            self::SalesIssue => 'Sales Issue',
            self::AdjustmentIn => 'Adjustment In',
            self::AdjustmentOut => 'Adjustment Out',
            self::TransferIn => 'Transfer In',
            self::TransferOut => 'Transfer Out',
        };
    }
}
