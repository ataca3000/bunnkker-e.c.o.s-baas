<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Domain\Enums;

/** How money was taken at a stop. Drives the settlement split. */
enum PaymentType: string
{
    case Cash = 'cash';
    case BankTransfer = 'bank_transfer';
    case Card = 'card';
    case AlreadyPaid = 'already_paid';

    public function label(): string
    {
        return match ($this) {
            self::Cash => 'Cash',
            self::BankTransfer => 'Bank Transfer',
            self::Card => 'Card / POS',
            self::AlreadyPaid => 'Already Paid',
        };
    }

    /**
     * Only cash physically travels with the driver, so only cash is reconciled
     * against what they hand back at settlement.
     */
    public function isPhysicalCash(): bool
    {
        return $this === self::Cash;
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }

    /** @return list<array{value: string, label: string}> */
    public static function options(): array
    {
        return array_map(
            static fn (self $c) => ['value' => $c->value, 'label' => $c->label()],
            self::cases(),
        );
    }
}
