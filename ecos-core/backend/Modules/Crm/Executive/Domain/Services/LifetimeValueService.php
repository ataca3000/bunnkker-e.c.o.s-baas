<?php

declare(strict_types=1);

namespace Modules\Crm\Executive\Domain\Services;

use Illuminate\Support\Facades\DB;
use Modules\Crm\Executive\Domain\Support\ExecutiveThresholds;
use Modules\Crm\Executive\Domain\Support\Metric;

/**
 * Lifetime value at portfolio level — totals, averages and concentration.
 *
 * Reads the C5 profiles (historical and predicted CLV) plus the C5 purchase facts
 * for period revenue. Commerce still owns the orders; this never touches them.
 */
final class LifetimeValueService
{
    /** @return array<string, mixed> */
    public function forCompany(string $companyId): array
    {
        // Qualified: this builder is cloned into a join against `customers`, which
        // carries its own company_id.
        $profiles = DB::table('crm_customer_intelligence_profiles')
            ->where('crm_customer_intelligence_profiles.company_id', $companyId);

        $customers = (clone $profiles)->count();
        $lifetime = round((float) (clone $profiles)->sum('lifetime_value'), 2);
        $predicted = round((float) (clone $profiles)->sum('predicted_lifetime_value'), 2);

        $top = (clone $profiles)
            ->join('customers', 'customers.id', '=', 'crm_customer_intelligence_profiles.customer_id')
            ->orderByDesc('crm_customer_intelligence_profiles.lifetime_value')
            ->limit(ExecutiveThresholds::TOP_CUSTOMERS_LIMIT)
            ->get([
                'crm_customer_intelligence_profiles.customer_id',
                'customers.name',
                'crm_customer_intelligence_profiles.lifetime_value',
                'crm_customer_intelligence_profiles.predicted_lifetime_value',
                'crm_customer_intelligence_profiles.rfm_segment',
            ])
            ->map(fn ($r) => [
                'customer_id' => $r->customer_id,
                'name' => $r->name,
                'lifetime_value' => round((float) $r->lifetime_value, 2),
                'predicted_lifetime_value' => round((float) $r->predicted_lifetime_value, 2),
                'segment' => $r->rfm_segment,
            ])->all();

        $topValue = array_sum(array_column($top, 'lifetime_value'));

        return [
            'customers_valued' => $customers,
            'total_lifetime_value' => $lifetime,
            'predicted_lifetime_value' => $predicted,
            'average_lifetime_value' => $customers > 0 ? round($lifetime / $customers, 2) : 0.0,
            'average_order_value' => $customers > 0 ? round((float) (clone $profiles)->avg('average_order_value'), 2) : 0.0,
            // What share of lifetime value sits in the top customers — concentration risk.
            'top_customer_value_share_percent' => Metric::rate($topValue, $lifetime),
            'top_customers' => $top,
            'by_segment' => (clone $profiles)
                ->groupBy('rfm_segment')
                ->selectRaw('rfm_segment as segment, count(*) as customers, sum(lifetime_value) as value')
                ->get()
                ->map(fn ($r) => [
                    'segment' => $r->segment,
                    'customers' => (int) $r->customers,
                    'lifetime_value' => round((float) $r->value, 2),
                ])->all(),
        ];
    }

    /** Revenue recognised in the window, from the C5 purchase facts. */
    public function revenueBetween(string $companyId, $start, $end): float
    {
        return round((float) DB::table('crm_customer_purchase_facts')
            ->where('company_id', $companyId)
            ->whereBetween('occurred_at', [$start, $end])
            ->sum('amount'), 2);
    }
}
