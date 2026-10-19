<?php

declare(strict_types=1);

namespace Modules\Crm\Executive\Domain\Services;

use Illuminate\Support\Facades\DB;
use Modules\Crm\Executive\Domain\Support\ExecutivePeriod;
use Modules\Crm\Executive\Domain\Support\Metric;

/**
 * Sales performance — the C4 funnel, read only.
 *
 * Leads to opportunities to quotes. Won opportunities carry an opaque order
 * reference; the value reported here is the CRM's own deal value, not a Commerce
 * order total and not a Finance figure.
 */
final class SalesPerformanceService
{
    /** @return array<string, mixed> */
    public function forPeriod(string $companyId, ExecutivePeriod $period): array
    {
        return [
            'leads' => $this->leads($companyId, $period),
            'opportunities' => $this->opportunities($companyId, $period),
            'quotes' => $this->quotes($companyId, $period),
        ];
    }

    /** @return array<string, mixed> */
    private function leads(string $companyId, ExecutivePeriod $period): array
    {
        $byStatus = DB::table('crm_leads')
            ->where('company_id', $companyId)
            ->whereBetween('created_at', [$period->start, $period->end])
            ->groupBy('status')->selectRaw('status, count(*) as total')->pluck('total', 'status');

        $created = (int) array_sum($byStatus->all());
        $converted = (int) ($byStatus['converted'] ?? 0);
        $qualified = (int) ($byStatus['qualified'] ?? 0);

        $previousCreated = DB::table('crm_leads')
            ->where('company_id', $companyId)
            ->whereBetween('created_at', [$period->previous()->start, $period->previous()->end])->count();

        return [
            'created' => Metric::compare($created, $previousCreated, 0),
            'qualified' => $qualified,
            'converted' => $converted,
            'conversion_rate_percent' => Metric::rate($converted, $created),
            'by_status' => $byStatus->map(fn ($v) => (int) $v)->all(),
        ];
    }

    /** @return array<string, mixed> */
    private function opportunities(string $companyId, ExecutivePeriod $period): array
    {
        // Deals decided inside the window (won or lost), by their decision date.
        $decided = DB::table('crm_opportunities')
            ->where('company_id', $companyId)
            ->where(function ($q) use ($period): void {
                $q->whereBetween('won_at', [$period->start, $period->end])
                    ->orWhereBetween('lost_at', [$period->start, $period->end]);
            })
            ->selectRaw(
                "sum(case when status = 'won' then 1 else 0 end) as won,"
                ." sum(case when status = 'lost' then 1 else 0 end) as lost,"
                ." sum(case when status = 'won' then amount else 0 end) as won_value"
            )->first();

        $won = (int) ($decided->won ?? 0);
        $lost = (int) ($decided->lost ?? 0);

        // The live pipeline, as it stands now.
        $pipeline = DB::table('crm_opportunities')
            ->where('company_id', $companyId)
            ->where('status', 'open')
            ->selectRaw('count(*) as total, sum(amount) as value, sum(amount * probability / 100) as weighted')
            ->first();

        $created = DB::table('crm_opportunities')
            ->where('company_id', $companyId)
            ->whereBetween('created_at', [$period->start, $period->end])->count();

        return [
            'created' => $created,
            'won' => $won,
            'lost' => $lost,
            'win_rate_percent' => Metric::rate($won, $won + $lost),
            'won_value' => round((float) ($decided->won_value ?? 0), 2),
            'open_opportunities' => (int) ($pipeline->total ?? 0),
            'pipeline_value' => round((float) ($pipeline->value ?? 0), 2),
            'weighted_pipeline_value' => round((float) ($pipeline->weighted ?? 0), 2),
        ];
    }

    /** @return array<string, mixed> */
    private function quotes(string $companyId, ExecutivePeriod $period): array
    {
        $row = DB::table('crm_quotes')
            ->where('company_id', $companyId)
            ->whereBetween('created_at', [$period->start, $period->end])
            ->selectRaw(
                'count(*) as total, sum(total) as value,'
                ." sum(case when status = 'accepted' then 1 else 0 end) as accepted,"
                ." sum(case when status = 'sent' then 1 else 0 end) as sent,"
                ." sum(case when status = 'accepted' then total else 0 end) as accepted_value"
            )->first();

        $total = (int) ($row->total ?? 0);
        $accepted = (int) ($row->accepted ?? 0);

        return [
            'created' => $total,
            'sent' => (int) ($row->sent ?? 0),
            'accepted' => $accepted,
            'acceptance_rate_percent' => Metric::rate($accepted, $total),
            'quoted_value' => round((float) ($row->value ?? 0), 2),
            'accepted_value' => round((float) ($row->accepted_value ?? 0), 2),
        ];
    }
}
