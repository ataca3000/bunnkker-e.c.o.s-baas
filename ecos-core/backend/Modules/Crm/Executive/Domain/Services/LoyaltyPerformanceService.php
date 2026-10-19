<?php

declare(strict_types=1);

namespace Modules\Crm\Executive\Domain\Services;

use Illuminate\Support\Facades\DB;
use Modules\Crm\Executive\Domain\Support\ExecutivePeriod;
use Modules\Crm\Executive\Domain\Support\Metric;

/**
 * Loyalty programme performance.
 *
 * The outstanding points balance is summed straight off C4's append-only ledger —
 * the same derivation the wallet uses — so the executive liability figure and a
 * member's own balance are the same number, computed the same way.
 */
final class LoyaltyPerformanceService
{
    /** @return array<string, mixed> */
    public function forPeriod(string $companyId, ExecutivePeriod $period): array
    {
        $accounts = DB::table('crm_loyalty_accounts')->where('company_id', $companyId);

        $enrolled = (clone $accounts)->count();
        $active = (clone $accounts)->where('status', 'active')->count();
        $enrolledInPeriod = (clone $accounts)->whereBetween('enrolled_at', [$period->start, $period->end])->count();
        $enrolledPrevious = (clone $accounts)
            ->whereBetween('enrolled_at', [$period->previous()->start, $period->previous()->end])->count();

        $movement = DB::table('crm_loyalty_transactions')
            ->where('company_id', $companyId)
            ->whereBetween('occurred_at', [$period->start, $period->end])
            ->selectRaw(
                'sum(case when points > 0 then points else 0 end) as earned,'
                .' sum(case when points < 0 then -points else 0 end) as redeemed,'
                .' count(*) as movements'
            )->first();

        $earned = (int) ($movement->earned ?? 0);
        $redeemed = (int) ($movement->redeemed ?? 0);

        // Outstanding liability: the whole ledger, not just this window.
        $outstanding = (int) DB::table('crm_loyalty_transactions')->where('company_id', $companyId)->sum('points');

        $redemptions = DB::table('crm_reward_redemptions')
            ->where('company_id', $companyId)
            ->whereBetween('created_at', [$period->start, $period->end])->count();

        return [
            'enrolled_accounts' => $enrolled,
            'active_accounts' => $active,
            'new_enrollments' => Metric::compare($enrolledInPeriod, $enrolledPrevious, 0),
            'points_earned' => $earned,
            'points_redeemed' => $redeemed,
            'points_movements' => (int) ($movement->movements ?? 0),
            'redemption_rate_percent' => Metric::rate($redeemed, $earned),
            'outstanding_points' => $outstanding,
            'reward_redemptions' => $redemptions,
            'tier_distribution' => $this->tiers($companyId),
        ];
    }

    /** @return array<int, array<string, mixed>> */
    private function tiers(string $companyId): array
    {
        return DB::table('crm_loyalty_accounts')
            ->leftJoin('crm_loyalty_tiers', 'crm_loyalty_tiers.id', '=', 'crm_loyalty_accounts.tier_id')
            ->where('crm_loyalty_accounts.company_id', $companyId)
            ->groupBy('crm_loyalty_tiers.name')
            ->selectRaw('crm_loyalty_tiers.name as tier, count(*) as members')
            ->get()
            ->map(fn ($r) => ['tier' => $r->tier ?? 'unassigned', 'members' => (int) $r->members])
            ->all();
    }
}
