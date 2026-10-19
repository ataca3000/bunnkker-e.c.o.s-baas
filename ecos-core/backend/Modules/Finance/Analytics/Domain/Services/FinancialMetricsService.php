<?php

declare(strict_types=1);

namespace Modules\Finance\Analytics\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Finance\Banking\Domain\Models\BankAccount;
use Modules\Finance\Cash\Domain\Models\CashAccount;
use Modules\Finance\Ledger\Domain\Enums\AccountCategory;
use Modules\Finance\Ledger\Domain\Enums\JournalStatus;
use Modules\Finance\Ledger\Domain\Enums\NormalBalance;
use Modules\Finance\Shared\Domain\Services\ControlAccountReconciliationService;
use Throwable;

/**
 * The financial-metrics kernel — the SINGLE source of every derived number in the
 * intelligence platform.
 *
 * ┌─ READ-ONLY · DERIVED ON READ · CALCULATED ONCE ─────────────────────────┐
 * │ Every dashboard, workspace, forecast, scenario and report composes THESE   │
 * │ figures; none re-implements the arithmetic. Values are aggregated live from │
 * │ the immutable ledger (signed by each account's normal balance) and the      │
 * │ subledgers — nothing is stored, nothing is duplicated. This is the CQRS      │
 * │ read side of the whole Finance OS.                                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class FinancialMetricsService
{
    public function __construct(private readonly ControlAccountReconciliationService $reconciliation) {}

    // ── Profit & Loss (activity within a window) ────────────────────────────────

    /** @return array<string, float> */
    public function profitAndLoss(string $companyId, Carbon $from, Carbon $to): array
    {
        $t = $this->categoryActivity($companyId, $from, $to);

        $revenue = $this->pick($t, [AccountCategory::OperatingRevenue]);
        $otherRevenue = $this->pick($t, [AccountCategory::OtherRevenue]);
        $cogs = $this->pick($t, [AccountCategory::CostOfSales]);
        $opex = $this->pick($t, [AccountCategory::OperatingExpense]);
        $otherExpense = $this->pick($t, [AccountCategory::OtherExpense]);

        $grossProfit = round($revenue - $cogs, 4);
        $operatingProfit = round($grossProfit - $opex, 4);
        $netProfit = round(($revenue + $otherRevenue) - ($cogs + $opex + $otherExpense), 4);
        $totalRevenue = round($revenue + $otherRevenue, 4);

        return [
            'revenue' => $revenue,
            'other_revenue' => $otherRevenue,
            'total_revenue' => $totalRevenue,
            'cost_of_sales' => $cogs,
            'gross_profit' => $grossProfit,
            'operating_expense' => $opex,
            'operating_profit' => $operatingProfit,
            'other_expense' => $otherExpense,
            'net_profit' => $netProfit,
            'gross_margin_pct' => $this->pct($grossProfit, $revenue),
            'operating_margin_pct' => $this->pct($operatingProfit, $revenue),
            'net_margin_pct' => $this->pct($netProfit, $totalRevenue),
        ];
    }

    // ── Balance sheet & working capital (cumulative as-of) ──────────────────────

    /** @return array<string, float> */
    public function balanceSheet(string $companyId, Carbon $asOf): array
    {
        $b = $this->categoryBalance($companyId, $asOf);

        $currentAssets = $this->pick($b, [AccountCategory::CurrentAsset]);
        $nonCurrentAssets = $this->pick($b, [AccountCategory::NonCurrentAsset]);
        $currentLiabilities = $this->pick($b, [AccountCategory::CurrentLiability]);
        $nonCurrentLiabilities = $this->pick($b, [AccountCategory::NonCurrentLiability]);
        $equity = $this->pick($b, [AccountCategory::Equity]);

        $totalAssets = round($currentAssets + $nonCurrentAssets, 4);
        $totalLiabilities = round($currentLiabilities + $nonCurrentLiabilities, 4);
        $workingCapital = round($currentAssets - $currentLiabilities, 4);

        return [
            'current_assets' => $currentAssets,
            'non_current_assets' => $nonCurrentAssets,
            'total_assets' => $totalAssets,
            'current_liabilities' => $currentLiabilities,
            'non_current_liabilities' => $nonCurrentLiabilities,
            'total_liabilities' => $totalLiabilities,
            'equity' => $equity,
            'working_capital' => $workingCapital,
            'current_ratio' => $currentLiabilities > 0 ? round($currentAssets / $currentLiabilities, 4) : null,
        ];
    }

    /** Cash + bank GL balances as-of — the cash position. */
    public function cashPosition(string $companyId, ?Carbon $asOf = null): float
    {
        $asOf ??= Carbon::today();

        $glAccountIds = array_values(array_unique(array_merge(
            CashAccount::query()->where('company_id', $companyId)->pluck('gl_account_id')->all(),
            BankAccount::query()->where('company_id', $companyId)->pluck('gl_account_id')->all(),
        )));

        if ($glAccountIds === []) {
            return 0.0;
        }

        $row = DB::table('finance_journal_lines as l')
            ->join('finance_journal_entries as e', 'e.id', '=', 'l.journal_entry_id')
            ->where('l.company_id', $companyId)
            ->whereIn('l.account_id', $glAccountIds)
            ->whereIn('e.status', $this->postedStatuses())
            ->whereDate('e.entry_date', '<=', $asOf->toDateString())
            ->selectRaw('COALESCE(SUM(l.debit),0) as d, COALESCE(SUM(l.credit),0) as c')
            ->first();

        return round((float) ($row->d ?? 0) - (float) ($row->c ?? 0), 4); // cash is an asset (debit-normal)
    }

    public function receivables(string $companyId): float
    {
        return $this->controlBalance($companyId, 'receivable');
    }

    public function payables(string $companyId): float
    {
        return $this->controlBalance($companyId, 'payable');
    }

    // ── Financial health (explainable composite) ────────────────────────────────

    /** @return array<string, mixed> */
    public function healthScore(string $companyId, Carbon $from, Carbon $to, ?Carbon $asOf = null): array
    {
        $asOf ??= $to;
        $pnl = $this->profitAndLoss($companyId, $from, $to);
        $bs = $this->balanceSheet($companyId, $asOf);
        $cash = $this->cashPosition($companyId, $asOf);

        $components = [];

        // Profitability — net margin.
        $components[] = $this->component('net_margin', $pnl['net_margin_pct'], match (true) {
            $pnl['net_margin_pct'] >= 15 => 100,
            $pnl['net_margin_pct'] >= 5 => 70,
            $pnl['net_margin_pct'] >= 0 => 40,
            default => 0,
        }, 'Net margin '.$pnl['net_margin_pct'].'%');

        // Liquidity — current ratio.
        $cr = $bs['current_ratio'];
        $components[] = $this->component('current_ratio', $cr, match (true) {
            $cr === null => 50,
            $cr >= 2 => 100,
            $cr >= 1 => 70,
            $cr >= 0.8 => 40,
            default => 10,
        }, 'Current ratio '.($cr ?? 'n/a'));

        // Solvency — equity share of assets.
        $equityRatio = $bs['total_assets'] > 0 ? round($bs['equity'] / $bs['total_assets'] * 100, 2) : 0.0;
        $components[] = $this->component('equity_ratio', $equityRatio, match (true) {
            $equityRatio >= 50 => 100,
            $equityRatio >= 30 => 70,
            $equityRatio >= 10 => 40,
            default => 10,
        }, 'Equity is '.$equityRatio.'% of assets');

        // Liquidity buffer — positive cash.
        $components[] = $this->component('cash_position', $cash, $cash > 0 ? 100 : 0, 'Cash position '.$cash);

        $score = round(array_sum(array_column($components, 'score')) / count($components), 2);

        return [
            'score' => $score,
            'rating' => $this->rating($score),
            'components' => $components,
        ];
    }

    // ── Time series (monthly) ───────────────────────────────────────────────────

    /**
     * A monthly series for a set of P&L categories over the last N months.
     *
     * @param  list<AccountCategory>  $categories
     * @return list<array{month:string, value:float}>
     */
    public function monthlyPnlSeries(string $companyId, array $categories, int $months = 12, ?Carbon $endMonth = null): array
    {
        $endMonth ??= Carbon::today()->startOfMonth();
        $series = [];

        for ($i = $months - 1; $i >= 0; $i--) {
            $start = $endMonth->copy()->subMonths($i)->startOfMonth();
            $end = $start->copy()->endOfMonth();
            $t = $this->categoryActivity($companyId, $start, $end);
            $series[] = ['month' => $start->format('Y-m'), 'value' => $this->pick($t, $categories)];
        }

        return $series;
    }

    /**
     * Signed activity per journal-line dimension over a window, for one category
     * set — the primitive behind branch/cost-center profitability.
     *
     * @param  list<AccountCategory>  $categories
     * @return array<string, float>  dimension value → signed amount
     */
    public function activityByDimension(string $companyId, array $categories, string $column, Carbon $from, Carbon $to): array
    {
        $normal = $categories[0]->type()->normalBalance();

        $rows = DB::table('finance_journal_lines as l')
            ->join('finance_journal_entries as e', 'e.id', '=', 'l.journal_entry_id')
            ->join('finance_accounts as a', 'a.id', '=', 'l.account_id')
            ->where('l.company_id', $companyId)
            ->whereIn('a.account_category', array_map(static fn (AccountCategory $c) => $c->value, $categories))
            ->whereIn('e.status', $this->postedStatuses())
            ->whereBetween('e.entry_date', [$from->toDateString(), $to->toDateString()])
            ->whereNotNull('l.'.$column)
            ->groupBy('l.'.$column)
            ->selectRaw("l.{$column} as dim, COALESCE(SUM(l.debit),0) as d, COALESCE(SUM(l.credit),0) as c")
            ->get();

        $out = [];
        foreach ($rows as $r) {
            $out[(string) $r->dim] = round($normal === NormalBalance::Debit ? (float) $r->d - (float) $r->c : (float) $r->c - (float) $r->d, 4);
        }

        return $out;
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    /** @return array<string, float> category value → signed amount (activity in window) */
    private function categoryActivity(string $companyId, Carbon $from, Carbon $to): array
    {
        return $this->categorySums($companyId, fn ($q) => $q->whereBetween('e.entry_date', [$from->toDateString(), $to->toDateString()]));
    }

    /** @return array<string, float> category value → signed amount (cumulative as-of) */
    private function categoryBalance(string $companyId, Carbon $asOf): array
    {
        return $this->categorySums($companyId, fn ($q) => $q->whereDate('e.entry_date', '<=', $asOf->toDateString()));
    }

    /** @return array<string, float> */
    private function categorySums(string $companyId, callable $dateFilter): array
    {
        $q = DB::table('finance_journal_lines as l')
            ->join('finance_journal_entries as e', 'e.id', '=', 'l.journal_entry_id')
            ->join('finance_accounts as a', 'a.id', '=', 'l.account_id')
            ->where('l.company_id', $companyId)
            ->whereNotNull('a.account_category')
            ->whereIn('e.status', $this->postedStatuses())
            ->groupBy('a.account_category')
            ->selectRaw('a.account_category as cat, COALESCE(SUM(l.debit),0) as d, COALESCE(SUM(l.credit),0) as c');

        $dateFilter($q);

        $out = [];
        foreach ($q->get() as $r) {
            $category = AccountCategory::tryFrom((string) $r->cat);
            if ($category === null) {
                continue;
            }
            $normal = $category->type()->normalBalance();
            $out[$category->value] = round($normal === NormalBalance::Debit ? (float) $r->d - (float) $r->c : (float) $r->c - (float) $r->d, 4);
        }

        return $out;
    }

    /** @param array<string, float> $totals @param list<AccountCategory> $categories */
    private function pick(array $totals, array $categories): float
    {
        $sum = 0.0;
        foreach ($categories as $c) {
            $sum += $totals[$c->value] ?? 0.0;
        }

        return round($sum, 4);
    }

    private function controlBalance(string $companyId, string $subledger): float
    {
        try {
            $r = $subledger === 'receivable'
                ? $this->reconciliation->receivable($companyId)
                : $this->reconciliation->payable($companyId);

            return (float) $r['gl_balance'];
        } catch (Throwable) {
            return 0.0;
        }
    }

    /** @return array<string, mixed> */
    private function component(string $key, mixed $value, int $score, string $explanation): array
    {
        return ['key' => $key, 'value' => $value, 'score' => $score, 'explanation' => $explanation];
    }

    private function rating(float $score): string
    {
        return match (true) {
            $score >= 80 => 'strong',
            $score >= 60 => 'healthy',
            $score >= 40 => 'watch',
            default => 'at_risk',
        };
    }

    private function pct(float $numerator, float $denominator): float
    {
        return $denominator != 0.0 ? round($numerator / $denominator * 100, 2) : 0.0;
    }

    /** @return list<string> */
    private function postedStatuses(): array
    {
        return [JournalStatus::Posted->value, JournalStatus::Reversed->value];
    }
}
