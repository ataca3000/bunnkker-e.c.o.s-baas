<?php

declare(strict_types=1);

namespace Modules\Finance\Intelligence\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Finance\Analytics\Domain\Services\FinancialMetricsService;
use Modules\Finance\Ledger\Domain\Enums\AccountCategory;

/**
 * Profitability analysis — derived from the ledger's own dimensions, never a
 * duplicated calculation.
 *
 * Company, branch and cost-center profitability come straight from the signed
 * journal-line dimensions. Customer profitability is revenue attributed from the
 * AR subledger with the company operating margin applied — the attribution
 * method is stated, not hidden. Product/channel are exposed as dimension-ready:
 * the ledger does not tag lines by product or channel, so their profitability
 * is company-level until those tags exist (surfaced honestly, not fabricated).
 */
final class ProfitabilityService
{
    private array $expenseCategories;

    private array $revenueCategories;

    public function __construct(private readonly FinancialMetricsService $metrics)
    {
        $this->revenueCategories = [AccountCategory::OperatingRevenue];
        $this->expenseCategories = [AccountCategory::CostOfSales, AccountCategory::OperatingExpense];
    }

    /** @return array<string, mixed> */
    public function company(string $companyId, Carbon $from, Carbon $to): array
    {
        $pnl = $this->metrics->profitAndLoss($companyId, $from, $to);

        return [
            'dimension' => 'company',
            'revenue' => $pnl['total_revenue'],
            'expense' => round($pnl['cost_of_sales'] + $pnl['operating_expense'] + $pnl['other_expense'], 4),
            'profit' => $pnl['net_profit'],
            'margin_pct' => $pnl['net_margin_pct'],
        ];
    }

    /** @return array<string, mixed> */
    public function byBranch(string $companyId, Carbon $from, Carbon $to): array
    {
        return $this->byDimension($companyId, 'branch_id', 'branch', $from, $to);
    }

    /** @return array<string, mixed> */
    public function byCostCenter(string $companyId, Carbon $from, Carbon $to): array
    {
        return $this->byDimension($companyId, 'cost_center_id', 'cost_center', $from, $to);
    }

    /** @return array<string, mixed> */
    public function byProject(string $companyId, Carbon $from, Carbon $to): array
    {
        return $this->byDimension($companyId, 'project_id', 'project', $from, $to);
    }

    /**
     * Customer profitability — AR revenue per customer with the company operating
     * margin applied (stated attribution).
     *
     * @return array<string, mixed>
     */
    public function byCustomer(string $companyId, Carbon $from, Carbon $to, int $limit = 50): array
    {
        $margin = $this->metrics->profitAndLoss($companyId, $from, $to)['operating_margin_pct'] / 100;

        $rows = DB::table('finance_customer_invoices')
            ->where('company_id', $companyId)
            ->where('status', 'posted')
            ->where('document_type', 'invoice')
            ->whereBetween('invoice_date', [$from->toDateString(), $to->toDateString()])
            ->groupBy('customer_id')
            ->selectRaw('customer_id, COALESCE(SUM(total),0) as revenue')
            ->orderByDesc('revenue')
            ->limit($limit)
            ->get();

        $lines = $rows->map(fn ($r) => [
            'customer_id' => $r->customer_id,
            'revenue' => round((float) $r->revenue, 4),
            'estimated_profit' => round((float) $r->revenue * $margin, 4),
            'margin_pct' => round($margin * 100, 2),
        ])->all();

        return [
            'dimension' => 'customer',
            'attribution' => 'AR revenue × company operating margin',
            'rows' => $lines,
        ];
    }

    /**
     * Product / channel profitability — dimension-ready. The ledger does not tag
     * journal lines by product or channel, so this returns the company total with
     * an explicit note rather than a fabricated split.
     *
     * @return array<string, mixed>
     */
    public function byUntaggedDimension(string $companyId, string $dimension, Carbon $from, Carbon $to): array
    {
        return [
            'dimension' => $dimension,
            'available' => false,
            'note' => "The ledger does not tag journal lines by {$dimension}; company-level profitability is shown. Tag postings by {$dimension} to break this down.",
            'company' => $this->company($companyId, $from, $to),
        ];
    }

    /** @return array<string, mixed> */
    private function byDimension(string $companyId, string $column, string $label, Carbon $from, Carbon $to): array
    {
        $revenue = $this->metrics->activityByDimension($companyId, $this->revenueCategories, $column, $from, $to);
        $expense = $this->metrics->activityByDimension($companyId, $this->expenseCategories, $column, $from, $to);

        $keys = array_unique(array_merge(array_keys($revenue), array_keys($expense)));
        $rows = [];
        foreach ($keys as $dim) {
            $rev = $revenue[$dim] ?? 0.0;
            $exp = $expense[$dim] ?? 0.0;
            $profit = round($rev - $exp, 4);
            $rows[] = [
                $label => $dim,
                'revenue' => $rev,
                'expense' => $exp,
                'profit' => $profit,
                'margin_pct' => $rev != 0.0 ? round($profit / $rev * 100, 2) : 0.0,
            ];
        }

        usort($rows, static fn ($a, $b) => $b['profit'] <=> $a['profit']);

        return ['dimension' => $label, 'rows' => $rows];
    }
}
