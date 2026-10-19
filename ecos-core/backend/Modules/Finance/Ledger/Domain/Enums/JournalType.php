<?php

declare(strict_types=1);

namespace Modules\Finance\Ledger\Domain\Enums;

/**
 * What kind of journal this is — the analytical classification of an entry.
 *
 * Distinct from `source` (manual vs posting) and `status` (draft/posted/…):
 * the type says WHAT the entry represents. F1 sets Manual, Reversal, Opening and
 * Adjustment; the operational types (Sales, Purchase, Cash, Bank) are declared
 * now and used by the subledger strategies in F3.
 */
enum JournalType: string
{
    case General = 'general';
    case Manual = 'manual';
    case Opening = 'opening';
    case Adjustment = 'adjustment';
    case Reversal = 'reversal';
    case Sales = 'sales';
    case Purchase = 'purchase';
    case Cash = 'cash';
    case Bank = 'bank';

    public function label(): string
    {
        return ucfirst($this->value);
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }

    /** @return list<array{value: string, label: string}> */
    public static function options(): array
    {
        return array_map(static fn (self $c) => ['value' => $c->value, 'label' => $c->label()], self::cases());
    }
}
