<?php

declare(strict_types=1);

namespace Modules\Purchasing\GoodsReceipts\Domain\Enums;

enum PaymentMethod: string
{
    case Cash = 'cash';
    case BankTransfer = 'bank_transfer';
    case Cheque = 'cheque';
    case Wallet = 'wallet';
    case Credit = 'credit';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Cash => 'Cash',
            self::BankTransfer => 'Bank Transfer',
            self::Cheque => 'Cheque',
            self::Wallet => 'Wallet',
            self::Credit => 'Credit',
            self::Other => 'Other',
        };
    }
}
