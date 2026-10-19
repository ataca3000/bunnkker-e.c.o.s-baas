<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Domain\Enums;

enum BusinessGoal: string
{
    case CustomerAcquisition = 'customer_acquisition';
    case CustomerRetention = 'customer_retention';
    case ProductLaunch = 'product_launch';
    case BrandAwareness = 'brand_awareness';
    case SalesGrowth = 'sales_growth';
    case MarketExpansion = 'market_expansion';
    case ChurnReduction = 'churn_reduction';
    case SeasonalPush = 'seasonal_push';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::CustomerAcquisition => 'Customer Acquisition',
            self::CustomerRetention => 'Customer Retention',
            self::ProductLaunch => 'Product Launch',
            self::BrandAwareness => 'Brand Awareness',
            self::SalesGrowth => 'Sales Growth',
            self::MarketExpansion => 'Market Expansion',
            self::ChurnReduction => 'Churn Reduction',
            self::SeasonalPush => 'Seasonal Push',
            self::Other => 'Other',
        };
    }
}
