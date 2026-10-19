<?php

declare(strict_types=1);

namespace Modules\Crm\Intelligence\Domain\Support;

/**
 * Every tunable constant behind the intelligence engines, named in one place.
 *
 * ┌─ DETERMINISTIC · EXPLAINABLE · NO MAGIC NUMBERS ────────────────────────┐
 * │ The health score, churn model and CLV projection are weighted formulas —   │
 * │ not learned models. Naming the weights here makes every score auditable and │
 * │ reproducible: the same facts and the same weights always yield the same     │
 * │ number, and the breakdown can be shown to a human.                         │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class IntelligenceWeights
{
    // ── Health score: weighted blend of four 0..100 components (must sum to 1.0)
    public const HEALTH_RECENCY = 0.35;
    public const HEALTH_FREQUENCY = 0.30;
    public const HEALTH_MONETARY = 0.20;
    public const HEALTH_TENURE = 0.15;

    /** Tenure that maps to a full 100 tenure-component (2 years). */
    public const TENURE_FULL_DAYS = 730;

    // ── Churn model
    /** Cadence multiple at which overdue-ness saturates the churn score at 100. */
    public const CHURN_OVERDUE_CAP_RATIO = 3.0;

    /** Assumed cadence (days) for a customer with only one purchase. */
    public const CHURN_SINGLE_ORDER_BASELINE_DAYS = 60;

    // ── CLV projection
    /** Forward horizon (years) for predicted lifetime value. */
    public const CLV_HORIZON_YEARS = 3;

    // ── Recommendation / retention thresholds
    /** Days after a first-and-only purchase before a second-purchase nudge fires. */
    public const SECOND_PURCHASE_NUDGE_DAYS = 30;

    /** Monetary quintile (>=) considered "high value" for cross-sell / win-back. */
    public const HIGH_VALUE_MONETARY_SCORE = 4;

    /** @return array<string, float> the health weights, for the explanation payload */
    public static function healthWeights(): array
    {
        return [
            'recency' => self::HEALTH_RECENCY,
            'frequency' => self::HEALTH_FREQUENCY,
            'monetary' => self::HEALTH_MONETARY,
            'tenure' => self::HEALTH_TENURE,
        ];
    }
}
