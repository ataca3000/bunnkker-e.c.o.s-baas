<?php

declare(strict_types=1);

namespace Modules\Finance\Reporting\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Finance\Analytics\Domain\Services\FinancialMetricsService;
use Modules\Finance\Fiscal\Domain\Models\FiscalYear;
use Modules\Finance\Ledger\Domain\Enums\AccountCategory;
use Modules\Finance\Ledger\Domain\Enums\JournalStatus;
use Modules\Finance\Ledger\Domain\Enums\NormalBalance;

/**
 * The two statutory financial statements — Income Statement and Balance Sheet.
 *
 * ┌─ WHAT THIS ADDS, AND WHAT IT REFUSES TO ADD ────────────────────────────┐
 * │ FinancialMetricsService already owns every derived figure and states     │
 * │ plainly that nothing may re-implement its arithmetic. So this service    │
 * │ does not compute totals — it ASKS for them, and adds the one thing a     │
 * │ statement needs that a metric does not: the account-level lines beneath  │
 * │ each total.                                                              │
 * │                                                                          │
 * │ Lines are signed by their CATEGORY's normal balance, exactly as the      │
 * │ metrics kernel signs its totals. Any other convention would produce      │
 * │ lines that look right individually and refuse to sum to the total above  │
 * │ them, which is the classic way a report loses trust.                     │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Read-only. Nothing here writes, and no figure is stored — a statement is a
 * view of the ledger at a moment, not a record to be kept in step with it.
 */
final class FinancialStatementService
{
    public function __construct(private readonly FinancialMetricsService $metrics) {}

    /**
     * Income Statement — activity within a window.
     *
     * @return array<string, mixed>
     */
    public function incomeStatement(string $companyId, Carbon $from, Carbon $to): array
    {
        $totals = $this->metrics->profitAndLoss($companyId, $from, $to);

        $lines = $this->accountLines(
            $companyId,
            fn ($q) => $q->whereBetween('e.entry_date', [$from->toDateString(), $to->toDateString()]),
            self::INCOME_CATEGORIES,
        );

        return [
            'company_id' => $companyId,
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'sections' => [
                'revenue' => $this->section($lines, [AccountCategory::OperatingRevenue], $totals['revenue']),
                'other_revenue' => $this->section($lines, [AccountCategory::OtherRevenue], $totals['other_revenue']),
                'cost_of_sales' => $this->section($lines, [AccountCategory::CostOfSales], $totals['cost_of_sales']),
                'operating_expense' => $this->section($lines, [AccountCategory::OperatingExpense], $totals['operating_expense']),
                'other_expense' => $this->section($lines, [AccountCategory::OtherExpense], $totals['other_expense']),
            ],
            'totals' => $totals,
        ];
    }

    /**
     * Balance Sheet — cumulative position as of a date.
     *
     * ┌─ WHY THE RESULT FOR THE YEAR APPEARS HERE ─────────────────────────┐
     * │ Revenue and expense accounts are not closed into equity until the   │
     * │ year end. Between closings the ledger therefore does NOT satisfy    │
     * │ assets = liabilities + equity on its own: the year's profit is      │
     * │ sitting in the P&L accounts, not yet in retained earnings.          │
     * │                                                                     │
     * │ So the statement reports that profit explicitly as the result for   │
     * │ the year and includes it in equity, which is what makes the sheet   │
     * │ balance mid-year. is_balanced and variance are published rather     │
     * │ than assumed — if the books are out, the statement says so instead  │
     * │ of quietly presenting a figure that does not add up.                │
     * └─────────────────────────────────────────────────────────────────────┘
     *
     * @return array<string, mixed>
     */
    public function balanceSheet(string $companyId, Carbon $asOf): array
    {
        $totals = $this->metrics->balanceSheet($companyId, $asOf);

        $lines = $this->accountLines(
            $companyId,
            fn ($q) => $q->whereDate('e.entry_date', '<=', $asOf->toDateString()),
            self::POSITION_CATEGORIES,
        );

        $resultForYear = $this->resultForYear($companyId, $asOf);

        $equityIncludingResult = round($totals['equity'] + $resultForYear, 4);
        $liabilitiesAndEquity = round($totals['total_liabilities'] + $equityIncludingResult, 4);
        $variance = round($totals['total_assets'] - $liabilitiesAndEquity, 4);

        return [
            'company_id' => $companyId,
            'as_of' => $asOf->toDateString(),
            'sections' => [
                'current_assets' => $this->section($lines, [AccountCategory::CurrentAsset], $totals['current_assets']),
                'non_current_assets' => $this->section($lines, [AccountCategory::NonCurrentAsset], $totals['non_current_assets']),
                'current_liabilities' => $this->section($lines, [AccountCategory::CurrentLiability], $totals['current_liabilities']),
                'non_current_liabilities' => $this->section($lines, [AccountCategory::NonCurrentLiability], $totals['non_current_liabilities']),
                'equity' => $this->section($lines, [AccountCategory::Equity], $totals['equity']),
            ],
            'totals' => $totals + [
                'result_for_year' => $resultForYear,
                'equity_including_result' => $equityIncludingResult,
                'total_liabilities_and_equity' => $liabilitiesAndEquity,
            ],
            // Published, not assumed. A statement that cannot say whether it
            // balances is worse than one that admits it does not.
            'is_balanced' => abs($variance) < 0.005,
            'variance' => $variance,
        ];
    }

    /** Categories that belong on the Income Statement. */
    private const INCOME_CATEGORIES = [
        AccountCategory::OperatingRevenue,
        AccountCategory::OtherRevenue,
        AccountCategory::CostOfSales,
        AccountCategory::OperatingExpense,
        AccountCategory::OtherExpense,
    ];

    /** Categories that belong on the Balance Sheet. */
    private const POSITION_CATEGORIES = [
        AccountCategory::CurrentAsset,
        AccountCategory::NonCurrentAsset,
        AccountCategory::CurrentLiability,
        AccountCategory::NonCurrentLiability,
        AccountCategory::Equity,
    ];

    /**
     * Net profit from the start of the fiscal year containing $asOf, up to $asOf.
     *
     * Falls back to the calendar year only when no fiscal year is defined — that
     * is a stated assumption about the window, not an invented number: the
     * arithmetic still comes from the metrics kernel either way.
     */
    private function resultForYear(string $companyId, Carbon $asOf): float
    {
        $year = FiscalYear::query()
            ->where('company_id', $companyId)
            ->whereDate('start_date', '<=', $asOf->toDateString())
            ->whereDate('end_date', '>=', $asOf->toDateString())
            ->first();

        $start = $year !== null
            ? Carbon::parse((string) $year->start_date)
            : $asOf->copy()->startOfYear();

        return (float) $this->metrics->profitAndLoss($companyId, $start, $asOf)['net_profit'];
    }

    /**
     * Per-account signed amounts, keyed by category.
     *
     * @param  list<AccountCategory>  $categories
     * @return array<string, list<array<string, mixed>>>
     */
    private function accountLines(string $companyId, callable $dateFilter, array $categories): array
    {
        $q = DB::table('finance_journal_lines as l')
            ->join('finance_journal_entries as e', 'e.id', '=', 'l.journal_entry_id')
            ->join('finance_accounts as a', 'a.id', '=', 'l.account_id')
            ->where('l.company_id', $companyId)
            ->whereIn('a.account_category', array_map(static fn (AccountCategory $c): string => $c->value, $categories))
            ->whereIn('e.status', [JournalStatus::Posted->value, JournalStatus::Reversed->value])
            ->groupBy('a.id', 'a.code', 'a.name', 'a.name_ar', 'a.account_category')
            ->orderBy('a.code')
            ->selectRaw(
                'a.id as account_id, a.code, a.name, a.name_ar, a.account_category as cat, '
                .'COALESCE(SUM(l.debit),0) as d, COALESCE(SUM(l.credit),0) as c'
            );

        $dateFilter($q);

        $out = [];

        foreach ($q->get() as $row) {
            $category = AccountCategory::tryFrom((string) $row->cat);

            if ($category === null) {
                continue;
            }

            // Signed exactly as the metrics kernel signs its category totals, so
            // the lines always sum to the total printed above them.
            $amount = $category->type()->normalBalance() === NormalBalance::Debit
                ? (float) $row->d - (float) $row->c
                : (float) $row->c - (float) $row->d;

            $out[$category->value][] = [
                'account_id' => (int) $row->account_id,
                'code' => (string) $row->code,
                'name' => (string) $row->name,
                'name_ar' => $row->name_ar !== null ? (string) $row->name_ar : null,
                'amount' => round($amount, 4),
            ];
        }

        return $out;
    }

    /**
     * One statement section: its lines and the total they belong to.
     *
     * @param  array<string, list<array<string, mixed>>>  $lines
     * @param  list<AccountCategory>  $categories
     * @return array<string, mixed>
     */
    private function section(array $lines, array $categories, float $total): array
    {
        $rows = [];

        foreach ($categories as $category) {
            foreach ($lines[$category->value] ?? [] as $line) {
                $rows[] = $line;
            }
        }

        return ['total' => round($total, 4), 'lines' => $rows];
    }
}
