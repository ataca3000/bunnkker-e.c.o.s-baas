<?php

declare(strict_types=1);

namespace Modules\Finance\Receivables\Domain\Enums;

/**
 * The kinds of movement that appear on the customer ledger.
 *
 * The stored ledger amount is already signed at write time; this enum records
 * the CANONICAL sign each movement carries so a service can never post the wrong
 * direction. Invoice/debit-note increase the receivable (+); credit-note,
 * receipt and write-off decrease it (−).
 */
enum CustomerLedgerEntryType: string
{
    case Invoice = 'invoice';
    case CreditNote = 'credit_note';
    case DebitNote = 'debit_note';
    case Receipt = 'receipt';
    case WriteOff = 'write_off';

    /** +1 increases the customer's balance (they owe more), −1 decreases it. */
    public function sign(): int
    {
        return match ($this) {
            self::Invoice, self::DebitNote => 1,
            self::CreditNote, self::Receipt, self::WriteOff => -1,
        };
    }
}
