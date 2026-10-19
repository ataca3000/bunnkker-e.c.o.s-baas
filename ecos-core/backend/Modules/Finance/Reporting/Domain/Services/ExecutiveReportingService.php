<?php

declare(strict_types=1);

namespace Modules\Finance\Reporting\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Finance\Analytics\Domain\Services\FinancialDashboardService;
use Modules\Finance\Analytics\Domain\Services\FinancialMetricsService;
use Modules\Finance\Ledger\Domain\Exceptions\FinanceException;
use Modules\Finance\Reporting\Domain\Models\ReportSnapshot;

/**
 * Executive reporting — summaries, scorecards and periodic reports assembled from
 * the metrics kernel and dashboards. Every figure is derived; the only thing this
 * writes is an OPTIONAL export-ready snapshot of the report (a read-model
 * archive), never a financial transaction.
 */
final class ExecutiveReportingService
{
    public function __construct(
        private readonly FinancialMetricsService $metrics,
        private readonly FinancialDashboardService $dashboards,
    ) {}

    /** @return array<string, mixed> */
    public function generate(string $companyId, string $type, Carbon $from, Carbon $to): array
    {
        return match ($type) {
            'executive_summary' => $this->executiveSummary($companyId, $from, $to),
            'scorecard' => $this->scorecard($companyId, $from, $to),
            'kpi' => $this->dashboards->executiveKpis($companyId, $from, $to),
            'monthly', 'quarterly', 'annual' => $this->periodReport($companyId, $type, $from, $to),
            default => throw new FinanceException("Unknown report type '{$type}'."),
        };
    }

    /** Persist a generated report as an export-ready snapshot (read-model archive). */
    public function snapshot(string $companyId, string $type, Carbon $from, Carbon $to, ?int $actorId = null): ReportSnapshot
    {
        $payload = $this->generate($companyId, $type, $from, $to);

        return ReportSnapshot::create([
            'company_id' => $companyId,
            'report_type' => $type,
            'title' => ucfirst(str_replace('_', ' ', $type)).' — '.$from->toDateString().' to '.$to->toDateString(),
            'period_from' => $from->toDateString(),
            'period_to' => $to->toDateString(),
            'payload' => $payload,
            'generated_by' => $actorId,
            'generated_at' => Carbon::now(),
        ]);
    }

    /** @return array<string, mixed> */
    private function executiveSummary(string $companyId, Carbon $from, Carbon $to): array
    {
        $pnl = $this->metrics->profitAndLoss($companyId, $from, $to);
        $bs = $this->metrics->balanceSheet($companyId, $to);
        $health = $this->metrics->healthScore($companyId, $from, $to, $to);

        return [
            'report' => 'executive_summary',
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'headline' => [
                'health_score' => $health['score'],
                'rating' => $health['rating'],
                'revenue' => $pnl['total_revenue'],
                'net_profit' => $pnl['net_profit'],
                'net_margin_pct' => $pnl['net_margin_pct'],
                'cash_position' => $this->metrics->cashPosition($companyId, $to),
                'working_capital' => $bs['working_capital'],
            ],
            'profit_and_loss' => $pnl,
            'balance_sheet' => $bs,
        ];
    }

    /** @return array<string, mixed> */
    private function scorecard(string $companyId, Carbon $from, Carbon $to): array
    {
        $pnl = $this->metrics->profitAndLoss($companyId, $from, $to);
        $bs = $this->metrics->balanceSheet($companyId, $to);

        $cards = [
            $this->card('Net margin', $pnl['net_margin_pct'], 10, '%'),
            $this->card('Gross margin', $pnl['gross_margin_pct'], 30, '%'),
            $this->card('Current ratio', $bs['current_ratio'] ?? 0, 1.5, 'x'),
            $this->card('Working capital', $bs['working_capital'], 0, ''),
        ];

        return ['report' => 'scorecard', 'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()], 'cards' => $cards];
    }

    /** @return array<string, mixed> */
    private function periodReport(string $companyId, string $type, Carbon $from, Carbon $to): array
    {
        return [
            'report' => $type,
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'profit_and_loss' => $this->metrics->profitAndLoss($companyId, $from, $to),
            'balance_sheet' => $this->metrics->balanceSheet($companyId, $to),
            'kpis' => $this->dashboards->executiveKpis($companyId, $from, $to),
        ];
    }

    /** @return array<string, mixed> */
    private function card(string $label, float $value, float $target, string $unit): array
    {
        return [
            'label' => $label,
            'value' => round($value, 2),
            'target' => $target,
            'unit' => $unit,
            'status' => $value >= $target ? 'on_target' : 'below_target',
        ];
    }
}
