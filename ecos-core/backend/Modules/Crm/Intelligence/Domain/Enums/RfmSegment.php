<?php

declare(strict_types=1);

namespace Modules\Crm\Intelligence\Domain\Enums;

/**
 * The eleven classic RFM segments.
 *
 * A customer's segment is DERIVED deterministically from its recency score (R)
 * and its combined frequency/monetary score (FM), both on a 1..5 quintile scale.
 * The mapping below is the standard RFM grid — fixed, inspectable, reproducible.
 */
enum RfmSegment: string
{
    case Champions = 'champions';
    case LoyalCustomers = 'loyal_customers';
    case PotentialLoyalists = 'potential_loyalists';
    case NewCustomers = 'new_customers';
    case Promising = 'promising';
    case NeedAttention = 'need_attention';
    case AboutToSleep = 'about_to_sleep';
    case AtRisk = 'at_risk';
    case CantLose = 'cant_lose';
    case Hibernating = 'hibernating';
    case Lost = 'lost';

    /**
     * Deterministic RFM grid. $r and $fm are quintile scores 1..5.
     */
    public static function fromScores(int $r, int $fm): self
    {
        $r = max(1, min(5, $r));
        $fm = max(1, min(5, $fm));

        return match (true) {
            $r >= 5 && $fm >= 5 => self::Champions,
            $r >= 4 && $fm >= 4 => self::Champions,
            $r >= 3 && $fm >= 4 => self::LoyalCustomers,
            $r >= 4 && $fm >= 2 => self::PotentialLoyalists,
            $r >= 5 && $fm <= 1 => self::NewCustomers,
            $r >= 4 && $fm <= 1 => self::Promising,
            $r == 3 && $fm == 3 => self::NeedAttention,
            $r == 3 && $fm >= 3 => self::NeedAttention,
            $r >= 3 && $fm <= 2 => self::AboutToSleep,
            $r == 2 && $fm >= 5 => self::CantLose,
            $r <= 1 && $fm >= 5 => self::CantLose,
            $r <= 2 && $fm >= 3 => self::AtRisk,
            $r <= 2 && $fm >= 1 => self::Hibernating,
            default => self::Lost,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Champions => 'Champions',
            self::LoyalCustomers => 'Loyal Customers',
            self::PotentialLoyalists => 'Potential Loyalists',
            self::NewCustomers => 'New Customers',
            self::Promising => 'Promising',
            self::NeedAttention => 'Need Attention',
            self::AboutToSleep => 'About To Sleep',
            self::AtRisk => 'At Risk',
            self::CantLose => "Can't Lose Them",
            self::Hibernating => 'Hibernating',
            self::Lost => 'Lost',
        };
    }

    /** Segments where retention is the operational priority. */
    public function isRetentionFocus(): bool
    {
        return in_array($this, [
            self::NeedAttention, self::AboutToSleep, self::AtRisk,
            self::CantLose, self::Hibernating, self::Lost,
        ], true);
    }
}
