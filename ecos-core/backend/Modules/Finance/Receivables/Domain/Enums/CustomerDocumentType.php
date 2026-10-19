<?php

declare(strict_types=1);

namespace Modules\Finance\Receivables\Domain\Enums;

/**
 * The three AR documents that share the customer-invoice shape.
 *
 * An invoice and a debit note both INCREASE what the customer owes (they debit
 * the AR control); a credit note DECREASES it (it credits the AR control). The
 * sign captures exactly that so the posting and the customer-ledger entry never
 * disagree on direction.
 */
enum CustomerDocumentType: string
{
    case Invoice = 'invoice';
    case CreditNote = 'credit_note';
    case DebitNote = 'debit_note';

    /** +1 increases the receivable (DR control), −1 decreases it (CR control). */
    public function receivableSign(): int
    {
        return $this === self::CreditNote ? -1 : 1;
    }

    public function ledgerEntryType(): CustomerLedgerEntryType
    {
        return match ($this) {
            self::Invoice => CustomerLedgerEntryType::Invoice,
            self::CreditNote => CustomerLedgerEntryType::CreditNote,
            self::DebitNote => CustomerLedgerEntryType::DebitNote,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Invoice => 'Invoice',
            self::CreditNote => 'Credit Note',
            self::DebitNote => 'Debit Note',
        };
    }
}
