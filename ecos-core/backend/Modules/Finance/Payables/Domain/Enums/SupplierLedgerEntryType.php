<?php

declare(strict_types=1);

namespace Modules\Finance\Payables\Domain\Enums;

/**
 * The kinds of movement that appear on the supplier ledger.
 *
 * A positive amount increases what we owe (a bill / debit note); a negative
 * decreases it (a credit note / a payment). Mirror of the customer ledger.
 */
enum SupplierLedgerEntryType: string
{
    case Bill = 'bill';
    case CreditNote = 'credit_note';
    case DebitNote = 'debit_note';
    case Payment = 'payment';

    /** +1 increases the payable (we owe more), −1 decreases it. */
    public function sign(): int
    {
        return match ($this) {
            self::Bill, self::DebitNote => 1,
            self::CreditNote, self::Payment => -1,
        };
    }
}
