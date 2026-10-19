<?php

declare(strict_types=1);

namespace Modules\Finance\Intelligence\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Finance\Analytics\Domain\Services\FinancialMetricsService;
use Modules\Finance\Payables\Domain\Services\ApAgingService;
use Modules\Finance\Receivables\Domain\Services\ArAgingService;

/**
 * Cash-flow intelligence — current position, forecast, receivable/payable
 * timing, liquidity projection and rule-based cash-risk alerts.
 *
 * All deterministic and explainable: the operating flow is the profit forecast,
 * collections and payments are scheduled from the AR/AP aging buckets, and every
 * risk alert states the rule that fired. Read-only.
 */
final class CashFlowIntelligenceService
{
    public function __construct(
        private readonly FinancialMetricsService $metrics,
        private readonly ForecastService $forecast,
        private readonly ArAgingService $arAging,
        private readonly ApAgingService $apAging,
    ) {}

    /** @return array<string, mixed> */
    public function current(string $companyId): array
    {
        $to = Carbon::today();
        $from = $to->copy()->startOfMonth();
        $pnl = $this->metrics->profitAndLoss($companyId, $from, $to);

        return [
            'cash_position' => $this->metrics->cashPosition($companyId, $to),
            'receivables' => $this->metrics->receivables($companyId),
            'payables' => $this->metrics->payables($companyId),
            'month_to_date_operating' => $pnl['net_profit'],
        ];
    }

    /** Expected collections from the AR aging buckets, scheduled by month. */
    public function receivableForecast(string $companyId): array
    {
        $t = $this->arAging->report($companyId)['totals'];

        return $this->schedule($t, 'expected_collection');
    }

    /** Expected payments from the AP aging buckets, scheduled by month. */
    public function payableForecast(string $companyId): array
    {
        $t = $this->apAging->report($companyId)['totals'];

        return $this->schedule($t, 'expected_payment');
    }

    /**
     * Liquidity projection over a horizon: opening cash + operating flow +
     * collections − payments, accumulated month by month.
     *
     * @return array<string, mixed>
     */
    public function liquidityProjection(string $companyId, int $horizon = 3): array
    {
        $opening = $this->metrics->cashPosition($companyId, Carbon::today());
        $operating = $this->forecast->profitabilityForecast($companyId, 12, $horizon)['forecast'];
        $collections = $this->receivableForecast($companyId)['schedule'];
        $payments = $this->payableForecast($companyId)['schedule'];

        $running = $opening;
        $months = [];
        for ($h = 0; $h < $horizon; $h++) {
            $op = (float) ($operating[$h]['value'] ?? 0);
            $in = (float) ($collections[$h]['amount'] ?? 0);
            $out = (float) ($payments[$h]['amount'] ?? 0);
            $net = round($op + $in - $out, 4);
            $running = round($running + $net, 4);

            $months[] = [
                'month' => $operating[$h]['month'] ?? Carbon::today()->addMonths($h + 1)->format('Y-m'),
                'operating_flow' => round($op, 4),
                'collections' => round($in, 4),
                'payments' => round($out, 4),
                'net_flow' => $net,
                'closing_cash' => $running,
            ];
        }

        return ['opening_cash' => $opening, 'months' => $months];
    }

    /**
     * Rule-based cash-risk alerts. Each alert names the rule that fired.
     *
     * @return list<array<string, mixed>>
     */
    public function riskAlerts(string $companyId, int $horizon = 3): array
    {
        $alerts = [];
        $projection = $this->liquidityProjection($companyId, $horizon);

        foreach ($projection['months'] as $m) {
            if ($m['closing_cash'] < 0) {
                $alerts[] = $this->alert('projected_cash_shortfall', 'critical',
                    "Projected cash turns negative ({$m['closing_cash']}) in {$m['month']}.");
                break;
            }
        }

        // Runway: months of cover at the current payables run-rate.
        $payables = $this->metrics->payables($companyId);
        $cash = $projection['opening_cash'];
        if ($payables > 0 && $cash < $payables) {
            $alerts[] = $this->alert('low_liquidity_cover', 'warning',
                "Cash ({$cash}) is below outstanding payables ({$payables}).");
        }

        // Overdue receivables concentration.
        $aging = $this->arAging->report($companyId)['totals'];
        $overdue = round($aging['61_90'] + $aging['90_plus'], 4);
        if ($aging['total'] > 0 && $overdue / $aging['total'] > 0.25) {
            $alerts[] = $this->alert('overdue_receivables', 'warning',
                "Over 25% of receivables ({$overdue}) are 60+ days overdue.");
        }

        return $alerts;
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    /** @param array<string, float> $buckets @return array<string, mixed> */
    private function schedule(array $buckets, string $label): array
    {
        // current + 1–30 land next month; 31–60 the month after; 61+ the third.
        $m1 = round(($buckets['current'] ?? 0) + ($buckets['1_30'] ?? 0), 4);
        $m2 = round($buckets['31_60'] ?? 0, 4);
        $m3 = round(($buckets['61_90'] ?? 0) + ($buckets['90_plus'] ?? 0), 4);

        $base = Carbon::today()->startOfMonth();

        return [
            'label' => $label,
            'total' => round($buckets['total'] ?? 0, 4),
            'schedule' => [
                ['month' => $base->copy()->addMonth()->format('Y-m'), 'amount' => $m1],
                ['month' => $base->copy()->addMonths(2)->format('Y-m'), 'amount' => $m2],
                ['month' => $base->copy()->addMonths(3)->format('Y-m'), 'amount' => $m3],
            ],
            'method' => 'aging_bucket_schedule',
        ];
    }

    /** @return array<string, mixed> */
    private function alert(string $key, string $severity, string $message): array
    {
        return ['key' => $key, 'severity' => $severity, 'message' => $message];
    }
}
