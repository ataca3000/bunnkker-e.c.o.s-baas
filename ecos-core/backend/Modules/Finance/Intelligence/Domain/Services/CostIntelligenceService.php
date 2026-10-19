<?php

declare(strict_types=1);

namespace Modules\Finance\Intelligence\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Finance\Analytics\Domain\Services\FinancialMetricsService;
use Modules\Finance\Ledger\Domain\Enums\AccountCategory;
use Modules\Finance\Ledger\Domain\Enums\JournalStatus;

/**
 * Cost intelligence — breakdown, trend and operational classification of cost,
 * all derived from expense-account activity in the ledger.
 *
 * Cost of sales, operating and other expense come from the account category.
 * The operational buckets (manufacturing, logistics, marketing, administrative)
 * are a DETERMINISTIC keyword classification of expense accounts — the rules are
 * returned with the result so the split is explainable, not a black box.
 */
final class CostIntelligenceService
{
    /** @var array<string, list<string>> */
    private const BUCKETS = [
        'manufacturing' => ['manufactur', 'production', 'wip', 'raw material', 'factory', 'assembly'],
        'logistics' => ['logistic', 'shipping', 'freight', 'delivery', 'carrier', 'transport', 'fleet', 'fuel', 'warehouse'],
        'marketing' => ['marketing', 'advertis', 'campaign', 'promotion', 'coupon', 'loyalty'],
        'administrative' => ['admin', 'office', 'salary', 'payroll', 'rent', 'utilit', 'insurance', 'depreciat', 'general', 'legal'],
    ];

    public function __construct(private readonly FinancialMetricsService $metrics) {}

    /** @return array<string, mixed> */
    public function breakdown(string $companyId, Carbon $from, Carbon $to): array
    {
        $accounts = $this->expenseAccountTotals($companyId, $from, $to);
        $total = round(array_sum(array_column($accounts, 'amount')), 4);

        return [
            'total_cost' => $total,
            'by_category' => $this->byCategory($companyId, $from, $to),
            'by_account' => $accounts,
        ];
    }

    /** @return array<string, mixed> */
    public function operationalClassification(string $companyId, Carbon $from, Carbon $to): array
    {
        $buckets = array_fill_keys([...array_keys(self::BUCKETS), 'other'], 0.0);

        foreach ($this->expenseAccountTotals($companyId, $from, $to) as $account) {
            $buckets[$this->classify($account['name'].' '.$account['code'])] += $account['amount'];
        }

        return [
            'buckets' => array_map(static fn ($v) => round($v, 4), $buckets),
            'rules' => self::BUCKETS,
            'method' => 'deterministic_keyword_classification',
        ];
    }

    /** @return array<string, mixed> */
    public function trend(string $companyId, int $months = 12): array
    {
        return [
            'series' => $this->metrics->monthlyPnlSeries(
                $companyId, [AccountCategory::CostOfSales, AccountCategory::OperatingExpense, AccountCategory::OtherExpense], $months,
            ),
        ];
    }

    /** @return array<string, float> */
    private function byCategory(string $companyId, Carbon $from, Carbon $to): array
    {
        return [
            'cost_of_sales' => $this->categoryTotal($companyId, AccountCategory::CostOfSales, $from, $to),
            'operating_expense' => $this->categoryTotal($companyId, AccountCategory::OperatingExpense, $from, $to),
            'other_expense' => $this->categoryTotal($companyId, AccountCategory::OtherExpense, $from, $to),
        ];
    }

    private function categoryTotal(string $companyId, AccountCategory $category, Carbon $from, Carbon $to): float
    {
        $series = $this->metrics->monthlyPnlSeries($companyId, [$category], $this->monthsBetween($from, $to), $to->copy()->startOfMonth());

        return round(array_sum(array_column($series, 'value')), 4);
    }

    /** @return list<array{account_id:int, code:string, name:string, amount:float}> */
    private function expenseAccountTotals(string $companyId, Carbon $from, Carbon $to): array
    {
        $rows = DB::table('finance_journal_lines as l')
            ->join('finance_journal_entries as e', 'e.id', '=', 'l.journal_entry_id')
            ->join('finance_accounts as a', 'a.id', '=', 'l.account_id')
            ->where('l.company_id', $companyId)
            ->whereIn('a.account_category', ['cost_of_sales', 'operating_expense', 'other_expense'])
            ->whereIn('e.status', [JournalStatus::Posted->value, JournalStatus::Reversed->value])
            ->whereBetween('e.entry_date', [$from->toDateString(), $to->toDateString()])
            ->groupBy('a.id', 'a.code', 'a.name')
            ->selectRaw('a.id as id, a.code as code, a.name as name, COALESCE(SUM(l.debit),0) - COALESCE(SUM(l.credit),0) as amount')
            ->havingRaw('COALESCE(SUM(l.debit),0) - COALESCE(SUM(l.credit),0) <> 0')
            ->get();

        return $rows->map(fn ($r) => [
            'account_id' => (int) $r->id,
            'code' => (string) $r->code,
            'name' => (string) $r->name,
            'amount' => round((float) $r->amount, 4),
        ])->sortByDesc('amount')->values()->all();
    }

    private function classify(string $haystack): string
    {
        $h = mb_strtolower($haystack);
        foreach (self::BUCKETS as $bucket => $keywords) {
            foreach ($keywords as $kw) {
                if (str_contains($h, $kw)) {
                    return $bucket;
                }
            }
        }

        return 'other';
    }

    private function monthsBetween(Carbon $from, Carbon $to): int
    {
        return max(1, $from->diffInMonths($to) + 1);
    }
}
