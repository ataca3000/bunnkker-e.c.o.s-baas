<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Enums;

/**
 * Which part of pay an adjustment corrects.
 *
 * These are exactly the four things Part 7 freezes at approval, which is not a
 * coincidence: an adjustment exists because one of them can no longer be edited.
 */
enum AdjustmentComponent: string
{
    case Bonus = 'bonus';
    case Commission = 'commission';
    case Deduction = 'deduction';
    case Advance = 'advance';

    /**
     * The table an original of this kind lives in.
     *
     * Returned as a string rather than a class so the enum stays free of model
     * imports — it is a vocabulary, not a lookup.
     */
    public function originalTable(): string
    {
        return match ($this) {
            self::Bonus => 'hr_bonuses',
            self::Commission => 'hr_commission_rules',
            self::Deduction => 'hr_deductions',
            self::Advance => 'hr_advances',
        };
    }

    /**
     * Which way this component normally moves pay.
     *
     * An adjustment may still be signed either way — recovering an overpaid bonus
     * is negative — but this is what the UI should suggest.
     */
    public function defaultSign(): int
    {
        return match ($this) {
            self::Bonus, self::Commission => 1,
            self::Deduction, self::Advance => -1,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Bonus => 'Bonus',
            self::Commission => 'Commission',
            self::Deduction => 'Deduction',
            self::Advance => 'Advance',
        };
    }
}
