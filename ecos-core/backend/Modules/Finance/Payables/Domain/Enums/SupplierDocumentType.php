<?php

declare(strict_types=1);

namespace Modules\Finance\Payables\Domain\Enums;

/**
 * The three AP documents that share the supplier-bill shape.
 *
 * A bill and a debit note both INCREASE what we owe (they credit the AP control);
 * a credit note DECREASES it (it debits the AP control). Mirror of the AR side.
 */
enum SupplierDocumentType: string
{
    case Bill = 'bill';
    case CreditNote = 'credit_note';
    case DebitNote = 'debit_note';

    /** +1 increases the payable (CR control), −1 decreases it (DR control). */
    public function payableSign(): int
    {
        return $this === self::CreditNote ? -1 : 1;
    }

    public function ledgerEntryType(): SupplierLedgerEntryType
    {
        return match ($this) {
            self::Bill => SupplierLedgerEntryType::Bill,
            self::CreditNote => SupplierLedgerEntryType::CreditNote,
            self::DebitNote => SupplierLedgerEntryType::DebitNote,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Bill => 'Bill',
            self::CreditNote => 'Credit Note',
            self::DebitNote => 'Debit Note',
        };
    }
}
