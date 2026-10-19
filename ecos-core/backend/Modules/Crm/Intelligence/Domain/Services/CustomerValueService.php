<?php

declare(strict_types=1);

namespace Modules\Crm\Intelligence\Domain\Services;

use Modules\Crm\Intelligence\Domain\Support\IntelligenceWeights;

/**
 * Lifetime value, average order value and purchase frequency.
 *
 * Historical CLV is simply money already spent. Predicted CLV is an EXPLAINABLE
 * projection — average order value × expected annual orders × horizon — every
 * factor of which is returned in the breakdown. No learned model, no black box.
 */
final class CustomerValueService
{
    /**
     * @param  array<string, mixed>  $aggregates  from PurchaseFactService::aggregates()
     * @return array<string, mixed>
     */
    public function evaluate(array $aggregates): array
    {
        $orders = (int) $aggregates['frequency'];
        $monetary = (float) $aggregates['monetary'];
        $aov = (float) $aggregates['average_order_value'];
        $monthlyFrequency = (float) $aggregates['purchase_frequency_monthly'];

        // Expected orders per year from the observed monthly cadence.
        $annualOrders = round($monthlyFrequency * 12, 2);

        $horizon = IntelligenceWeights::CLV_HORIZON_YEARS;
        $predicted = $orders === 0 ? 0.0 : round($aov * $annualOrders * $horizon, 2);

        return [
            'average_order_value' => $aov,
            'lifetime_value' => $monetary,                 // historical = money already spent
            'predicted_lifetime_value' => $predicted,
            'annual_orders' => $annualOrders,
            'purchase_frequency_monthly' => $monthlyFrequency,
            'explanation' => [
                'historical_clv' => $monetary,
                'formula' => 'predicted = average_order_value × annual_orders × horizon_years',
                'average_order_value' => $aov,
                'annual_orders' => $annualOrders,
                'horizon_years' => $horizon,
                'predicted_clv' => $predicted,
            ],
        ];
    }
}
