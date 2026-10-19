<?php

declare(strict_types=1);

namespace Modules\Crm\Executive\Domain\Support;

/**
 * Every named constant behind the executive metrics.
 *
 * ┌─ NO MAGIC NUMBERS IN A BOARD REPORT ────────────────────────────────────┐
 * │ Satisfaction scales, NPS bandings and SLA targets are policy, not folklore. │
 * │ Naming them here means a number on the executive dashboard can always be    │
 * │ traced to the rule that produced it.                                       │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class ExecutiveThresholds
{
    // ── Satisfaction (crm_service_tickets.satisfaction_rating)
    /** The rating scale in use: 1..5, where 5 is best. */
    public const CSAT_SCALE_MIN = 1;

    public const CSAT_SCALE_MAX = 5;

    /** A rating at or above this counts as "satisfied" for CSAT. */
    public const CSAT_SATISFIED_MIN = 4;

    // ── NPS derived from the same 1..5 rating (standard 5-point → NPS mapping)
    /** 5 = promoter. */
    public const NPS_PROMOTER_MIN = 5;

    /** 1..3 = detractor; 4 is a passive. */
    public const NPS_DETRACTOR_MAX = 3;

    // ── Service level targets (percentage attainment)
    public const SLA_TARGET_PERCENT = 95.0;

    // ── Reporting
    /** Maximum buckets in a growth time series (keeps the query count bounded). */
    public const MAX_TREND_BUCKETS = 12;

    /** How many customers a "top customers by value" list returns. */
    public const TOP_CUSTOMERS_LIMIT = 10;

    /** @return array<string, int|float> the satisfaction policy, for the explanation payload */
    public static function satisfactionPolicy(): array
    {
        return [
            'scale_min' => self::CSAT_SCALE_MIN,
            'scale_max' => self::CSAT_SCALE_MAX,
            'csat_satisfied_min' => self::CSAT_SATISFIED_MIN,
            'nps_promoter_min' => self::NPS_PROMOTER_MIN,
            'nps_detractor_max' => self::NPS_DETRACTOR_MAX,
        ];
    }
}
