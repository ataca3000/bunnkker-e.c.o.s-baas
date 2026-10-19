<?php

declare(strict_types=1);

namespace Modules\POS\Shared\Domain\Enums;

/**
 * Cash rounding method for the final payment amount.
 *
 * Used when rounding to the nearest cash unit (e.g. 0.25 EGP).
 * The rounding unit is configured via pos.payment.cash_rounding_unit.
 * (ADR-POS-001: PostgreSQL; config/pos.php)
 */
enum RoundingMethod: string
{
    case Nearest = 'nearest';
    case Up = 'up';
    case Down = 'down';

    /**
     * Apply this rounding method to a raw amount given a rounding unit.
     * Returns the rounded amount as a BCMath string.
     */
    public function round(string $amount, string $unit = '0.01'): string
    {
        $units = (float) $amount / (float) $unit;
        $roundedUnits = match ($this) {
            self::Up => ceil($units),
            self::Down => floor($units),
            self::Nearest => round($units),
        };

        return bcmul((string) $roundedUnits, $unit, 2);
    }
}
