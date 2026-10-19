<?php

declare(strict_types=1);

namespace Modules\POS\Shared\Domain\Enums;

enum PaymentMethodType: string
{
    case Cash = 'cash';
    case Card = 'card';
    case StoreCredit = 'store_credit';
    case LoyaltyPoints = 'loyalty_points';
    case GiftCard = 'gift_card';
    case BankTransfer = 'bank_transfer';

    /** Electronic methods do not require physical change calculation. */
    public function isElectronic(): bool
    {
        return match ($this) {
            self::Card, self::BankTransfer, self::StoreCredit,
            self::LoyaltyPoints, self::GiftCard => true,
            default => false,
        };
    }

    /** Only cash payments require the cashier to calculate and dispense change. */
    public function requiresChangeCalculation(): bool
    {
        return $this === self::Cash;
    }

    /**
     * Store credit and loyalty points are redeemed against customer accounts
     * managed by the Accounting/CRM modules respectively. (ADR-POS-004)
     */
    public function isAccountBased(): bool
    {
        return match ($this) {
            self::StoreCredit, self::LoyaltyPoints => true,
            default => false,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Cash => 'Cash',
            self::Card => 'Card',
            self::StoreCredit => 'Store Credit',
            self::LoyaltyPoints => 'Loyalty Points',
            self::GiftCard => 'Gift Card',
            self::BankTransfer => 'Bank Transfer',
        };
    }
}
