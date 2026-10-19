<?php

declare(strict_types=1);

namespace Modules\Crm\Intelligence\Domain\Enums;

/** The kind of next-best-action a deterministic rule can suggest. */
enum RecommendationType: string
{
    case Retention = 'retention';
    case Reactivation = 'reactivation';
    case WinBack = 'win_back';
    case Upsell = 'upsell';
    case CrossSell = 'cross_sell';
    case Onboarding = 'onboarding';
    case VipTreatment = 'vip_treatment';
    case LoyaltyEnrollment = 'loyalty_enrollment';

    public function label(): string
    {
        return match ($this) {
            self::Retention => 'Retention',
            self::Reactivation => 'Reactivation',
            self::WinBack => 'Win Back',
            self::Upsell => 'Upsell',
            self::CrossSell => 'Cross-sell',
            self::Onboarding => 'Onboarding',
            self::VipTreatment => 'VIP Treatment',
            self::LoyaltyEnrollment => 'Loyalty Enrollment',
        };
    }
}
