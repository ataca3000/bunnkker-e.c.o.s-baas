<?php

declare(strict_types=1);

namespace Modules\Marketing\Intelligence\Application\Services;

use Modules\Marketing\Intelligence\Application\Dto\IntelligenceFilterDto;

/**
 * Computes the Marketing Health Score (0–100) for a given filter context.
 *
 * The score is a weighted composite of five components:
 *
 *  Component         Weight  Target
 *  ────────────────  ──────  ────────────────
 *  ROAS              30%     ≥ 3.0
 *  CTR               20%     ≥ 2% (0.02)
 *  Revenue Activity  20%     has revenue
 *  Acquisition       15%     has purchases or leads
 *  Spend Activity    15%     spend > 0 in period
 *
 * Each component scores 0–100, then weighted to produce a final 0–100 integer.
 * The label maps as: ≥80 → Excellent, ≥60 → Good, ≥40 → Needs Attention, <40 → Poor.
 */
final class MarketingHealthScoreService
{
    public function __construct(
        private readonly MarketingKpiEngine $engine,
    ) {}

    /**
     * @return array{score: int, label: string, components: array<string, array<string, mixed>>}
     */
    public function compute(IntelligenceFilterDto $filter): array
    {
        $kpis = $this->engine->kpis($filter);

        $roas = (float) ($kpis['roas'] ?? 0);
        $ctr = (float) ($kpis['ctr'] ?? 0);   // stored as decimal 0.02 = 2%
        $spend = (float) ($kpis['spend'] ?? 0);
        $revenue = (float) ($kpis['revenue'] ?? 0);
        $purchases = (int) ($kpis['purchases'] ?? 0);
        $leads = (int) ($kpis['leads'] ?? 0);

        // ── Component scores ────────────────────────────────────────────────────

        // ROAS: 0 → 0 pts, 1 → 33 pts, 2 → 67 pts, 3+ → 100 pts
        $roasScore = (int) min(100, max(0, $roas / 3.0 * 100));

        // CTR: 0 → 0 pts, 1% → 50 pts, 2%+ → 100 pts
        $ctrPct = $ctr * 100; // convert to percentage
        $ctrScore = (int) min(100, max(0, $ctrPct / 2.0 * 100));

        // Revenue activity: tiered — no revenue = 0, revenue > 0 = 60, revenue > spend = 100
        $revScore = 0;
        if ($revenue > $spend && $spend > 0) {
            $revScore = 100;
        } elseif ($revenue > 0) {
            $revScore = 60;
        }

        // Acquisition: has purchases or leads
        $acqScore = 0;
        if ($purchases > 0 && $leads > 0) {
            $acqScore = 100;
        } elseif ($purchases > 0 || $leads > 0) {
            $acqScore = 60;
        }

        // Spend activity: any spend this period
        $spendScore = $spend > 0 ? 100 : 0;

        // ── Weighted aggregate ──────────────────────────────────────────────────

        $score = (int) round(
            $roasScore * 0.30 +
            $ctrScore * 0.20 +
            $revScore * 0.20 +
            $acqScore * 0.15 +
            $spendScore * 0.15,
        );

        $score = min(100, max(0, $score));

        return [
            'score' => $score,
            'label' => $this->label($score),
            'components' => [
                'roas' => [
                    'score' => $roasScore,
                    'weight' => 0.30,
                    'actual_roas' => $roas,
                    'target' => 3.0,
                ],
                'ctr' => [
                    'score' => $ctrScore,
                    'weight' => 0.20,
                    'actual_ctr' => round($ctrPct, 4),
                    'target' => 2.0,
                ],
                'revenue_activity' => [
                    'score' => $revScore,
                    'weight' => 0.20,
                    'revenue' => $revenue,
                    'spend' => $spend,
                ],
                'acquisition' => [
                    'score' => $acqScore,
                    'weight' => 0.15,
                    'purchases' => $purchases,
                    'leads' => $leads,
                ],
                'spend_activity' => [
                    'score' => $spendScore,
                    'weight' => 0.15,
                    'spend' => $spend,
                ],
            ],
        ];
    }

    private function label(int $score): string
    {
        return match (true) {
            $score >= 80 => 'Excellent',
            $score >= 60 => 'Good',
            $score >= 40 => 'Needs Attention',
            default => 'Poor',
        };
    }
}
