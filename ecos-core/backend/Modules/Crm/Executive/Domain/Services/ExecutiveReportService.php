<?php

declare(strict_types=1);

namespace Modules\Crm\Executive\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Crm\Executive\Domain\Enums\ReportPeriod;
use Modules\Crm\Executive\Domain\Support\ExecutivePeriod;

/**
 * Executive reporting — monthly, quarterly and annual, export-ready.
 *
 * ┌─ GENERATED, NEVER STORED ───────────────────────────────────────────────┐
 * │ A report is a projection of the same dashboard over a calendar window, so a  │
 * │ re-run for March always reproduces March. Nothing is persisted: there is no  │
 * │ report table to fall out of step with the data, and no write path at all.   │
 * │ `export()` flattens the sections into rows a CSV or spreadsheet can take     │
 * │ directly.                                                                   │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class ExecutiveReportService
{
    public function __construct(private readonly ExecutiveDashboardService $dashboard) {}

    public function monthly(string $companyId, int $year, int $month): array
    {
        return $this->forPeriod($companyId, ExecutivePeriod::monthly($year, $month));
    }

    public function quarterly(string $companyId, int $year, int $quarter): array
    {
        return $this->forPeriod($companyId, ExecutivePeriod::quarterly($year, $quarter));
    }

    public function annual(string $companyId, int $year): array
    {
        return $this->forPeriod($companyId, ExecutivePeriod::annual($year));
    }

    /** @return array<string, mixed> */
    public function forPeriod(string $companyId, ExecutivePeriod $period): array
    {
        $data = $this->dashboard->overview($companyId, $period);

        return [
            'title' => 'Executive CRM Report — '.$period->label,
            'period' => $period->toArray(),
            'comparison_period' => $period->previous()->toArray(),
            'generated_at' => Carbon::now()->toDateTimeString(),
            'headline' => $data['headline'],
            'sections' => $this->sections($data),
        ];
    }

    /**
     * The report flattened for export — one row per metric.
     *
     * @return array<string, mixed>
     */
    public function export(string $companyId, ExecutivePeriod $period): array
    {
        $report = $this->forPeriod($companyId, $period);

        $rows = [];
        foreach ($report['sections'] as $section) {
            foreach ($section['metrics'] as $metric) {
                $rows[] = [
                    'section' => $section['title'],
                    'metric' => $metric['label'],
                    'value' => $metric['value'],
                    'previous' => $metric['previous'],
                    'change_percent' => $metric['change_percent'],
                    'trend' => $metric['trend'],
                    'format' => $metric['format'],
                ];
            }
        }

        return [
            'filename' => $this->filename($period),
            'title' => $report['title'],
            'generated_at' => $report['generated_at'],
            'columns' => ['Section', 'Metric', 'Value', 'Previous', 'Change %', 'Trend'],
            'rows' => $rows,
        ];
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    /**
     * @param  array<string, mixed>  $d  the dashboard payload
     * @return array<int, array<string, mixed>>
     */
    private function sections(array $d): array
    {
        return [
            $this->section('customers', 'Customers', [
                $this->row('Total customers', $d['customers']['total_customers'], 'integer'),
                $this->row('New customers', $d['customers']['new_customers'], 'integer'),
                $this->row('Active customers', $d['customers']['active_customers'], 'integer'),
                $this->row('Prospects', $d['customers']['prospects'], 'integer'),
            ]),
            $this->section('growth', 'Growth', [
                $this->row('Customers acquired', $d['growth']['acquired'], 'integer'),
                $this->row('Opening customers', $d['growth']['opening_customers'], 'integer'),
                $this->row('Closing customers', $d['growth']['closing_customers'], 'integer'),
                $this->row('Growth rate', $d['growth']['growth_rate_percent'], 'percent'),
            ]),
            $this->section('retention', 'Retention & Churn', [
                $this->row('Retention rate', $d['retention']['retention_rate_percent'], 'percent'),
                $this->row('Churn rate', $d['retention']['churn_rate_percent'], 'percent'),
                $this->row('Repeat purchase rate', $d['retention']['repeat_purchase_rate_percent'], 'percent'),
                $this->row('Customers at risk', $d['retention']['at_risk_customers'], 'integer'),
            ]),
            $this->section('value', 'Lifetime Value', [
                $this->row('Revenue in period', $d['headline']['revenue_in_period'], 'currency'),
                $this->row('Total lifetime value', $d['lifetime_value']['total_lifetime_value'], 'currency'),
                $this->row('Predicted lifetime value', $d['lifetime_value']['predicted_lifetime_value'], 'currency'),
                $this->row('Average lifetime value', $d['lifetime_value']['average_lifetime_value'], 'currency'),
                $this->row('Average order value', $d['lifetime_value']['average_order_value'], 'currency'),
            ]),
            $this->section('satisfaction', 'Satisfaction', [
                $this->row('CSAT', $d['satisfaction']['csat_percent'], 'percent'),
                $this->row('NPS', $d['satisfaction']['nps'], 'score'),
                $this->row('Average rating', $d['satisfaction']['average_rating'], 'number'),
                $this->row('Responses', $d['satisfaction']['responses'], 'integer'),
            ]),
            $this->section('service', 'Service Desk', [
                $this->row('Open tickets', $d['service']['open_tickets'], 'integer'),
                $this->row('Overdue tickets', $d['service']['overdue_open'], 'integer'),
                $this->row('First response SLA', $d['service']['sla']['first_response_attainment_percent'], 'percent'),
                $this->row('Resolution SLA', $d['service']['sla']['resolution_attainment_percent'], 'percent'),
                $this->row('Average resolution hours', $d['service']['throughput']['average_resolution_hours'], 'number'),
                $this->row('Reopen rate', $d['service']['throughput']['reopen_rate_percent'], 'percent'),
            ]),
            $this->section('sales', 'Sales', [
                $this->row('Leads created', $d['sales']['leads']['created'], 'integer'),
                $this->row('Lead conversion rate', $d['sales']['leads']['conversion_rate_percent'], 'percent'),
                $this->row('Opportunities won', $d['sales']['opportunities']['won'], 'integer'),
                $this->row('Win rate', $d['sales']['opportunities']['win_rate_percent'], 'percent'),
                $this->row('Won value', $d['sales']['opportunities']['won_value'], 'currency'),
                $this->row('Weighted pipeline', $d['sales']['opportunities']['weighted_pipeline_value'], 'currency'),
                $this->row('Quote acceptance rate', $d['sales']['quotes']['acceptance_rate_percent'], 'percent'),
            ]),
            $this->section('loyalty', 'Loyalty', [
                $this->row('Enrolled accounts', $d['loyalty']['enrolled_accounts'], 'integer'),
                $this->row('New enrollments', $d['loyalty']['new_enrollments'], 'integer'),
                $this->row('Points earned', $d['loyalty']['points_earned'], 'integer'),
                $this->row('Points redeemed', $d['loyalty']['points_redeemed'], 'integer'),
                $this->row('Redemption rate', $d['loyalty']['redemption_rate_percent'], 'percent'),
                $this->row('Outstanding points', $d['loyalty']['outstanding_points'], 'integer'),
            ]),
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $metrics
     * @return array<string, mixed>
     */
    private function section(string $key, string $title, array $metrics): array
    {
        return ['key' => $key, 'title' => $title, 'metrics' => $metrics];
    }

    /**
     * Normalises both shapes a metric arrives in — a compared metric (value +
     * previous + trend) or a bare scalar.
     *
     * @return array<string, mixed>
     */
    private function row(string $label, mixed $metric, string $format): array
    {
        if (is_array($metric) && array_key_exists('value', $metric)) {
            return [
                'label' => $label,
                'value' => $metric['value'],
                'previous' => $metric['previous'] ?? null,
                'change_percent' => $metric['change_percent'] ?? null,
                'trend' => $metric['trend'] ?? 'flat',
                'format' => $format,
            ];
        }

        return [
            'label' => $label,
            'value' => $metric,
            'previous' => null,
            'change_percent' => null,
            'trend' => 'flat',
            'format' => $format,
        ];
    }

    private function filename(ExecutivePeriod $period): string
    {
        $suffix = match ($period->type) {
            ReportPeriod::Monthly => $period->start->format('Y-m'),
            ReportPeriod::Quarterly => $period->start->format('Y').'-Q'.(int) ceil((int) $period->start->month / 3),
            ReportPeriod::Annual => $period->start->format('Y'),
            ReportPeriod::Custom => $period->start->format('Y-m-d').'_'.$period->end->format('Y-m-d'),
        };

        return "crm-executive-{$suffix}.csv";
    }
}
