<?php

declare(strict_types=1);

namespace Modules\Crm\Executive\Domain\Support;

use Modules\Crm\Executive\Domain\Enums\TrendDirection;

/** Shaping helpers so every executive metric is presented identically. */
final class Metric
{
    /**
     * A metric with its comparison-period value, absolute change, percentage
     * change and derived trend.
     *
     * @return array<string, mixed>
     */
    public static function compare(float|int $current, float|int|null $previous, int $precision = 2): array
    {
        $currentValue = round((float) $current, $precision);
        $previousValue = $previous === null ? null : round((float) $previous, $precision);

        $change = $previousValue === null ? null : round($currentValue - $previousValue, $precision);
        $changePercent = null;
        if ($previousValue !== null && abs($previousValue) > 0.0) {
            $changePercent = round((($currentValue - $previousValue) / abs($previousValue)) * 100, 2);
        }

        return [
            'value' => $currentValue,
            'previous' => $previousValue,
            'change' => $change,
            'change_percent' => $changePercent,
            'trend' => TrendDirection::fromDelta((float) ($change ?? 0))->value,
        ];
    }

    /** A percentage rate, guarding the zero denominator. */
    public static function rate(float|int $numerator, float|int $denominator, int $precision = 2): float
    {
        if ((float) $denominator === 0.0) {
            return 0.0;
        }

        return round(((float) $numerator / (float) $denominator) * 100, $precision);
    }

    /** A ratio in 0..1, guarding the zero denominator. */
    public static function ratio(float|int $numerator, float|int $denominator, int $precision = 4): float
    {
        if ((float) $denominator === 0.0) {
            return 0.0;
        }

        return round((float) $numerator / (float) $denominator, $precision);
    }
}
