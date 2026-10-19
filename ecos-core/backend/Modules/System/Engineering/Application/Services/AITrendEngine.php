<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Application\Services;

use Modules\System\Engineering\Domain\Models\EngineeringAIReview;
use Modules\System\Engineering\Domain\Models\EngineeringAITrend;

class AITrendEngine
{
    public function recordSnapshot(EngineeringAIReview $review): void
    {
        $this->upsertPeriod($review->company_id, 'daily',   now()->format('Y-m-d'),    $review);
        $this->upsertPeriod($review->company_id, 'weekly',  'W' . now()->format('W'),  $review);
        $this->upsertPeriod($review->company_id, 'monthly', now()->format('Y-m'),       $review);
    }

    public function getDailyTrend(string $companyId, int $days = 30): array
    {
        return EngineeringAITrend::where('company_id', $companyId)
            ->where('period_type', 'daily')
            ->orderBy('period_label', 'desc')
            ->limit($days)->get()->reverse()->values()->toArray();
    }

    public function getWeeklyTrend(string $companyId, int $weeks = 12): array
    {
        return EngineeringAITrend::where('company_id', $companyId)
            ->where('period_type', 'weekly')
            ->orderBy('period_label', 'desc')
            ->limit($weeks)->get()->reverse()->values()->toArray();
    }

    public function getMonthlyTrend(string $companyId, int $months = 6): array
    {
        return EngineeringAITrend::where('company_id', $companyId)
            ->where('period_type', 'monthly')
            ->orderBy('period_label', 'desc')
            ->limit($months)->get()->reverse()->values()->toArray();
    }

    public function getScoreTrend(string $companyId, string $periodType = 'daily', int $limit = 30): array
    {
        return EngineeringAITrend::where('company_id', $companyId)
            ->where('period_type', $periodType)
            ->orderBy('period_label', 'desc')
            ->limit($limit)->get()
            ->map(fn($t) => ['period' => $t->period_label, 'score' => $t->overall_score, 'reviews' => $t->review_count])
            ->reverse()->values()->toArray();
    }

    private function upsertPeriod(string $companyId, string $type, string $label, EngineeringAIReview $review): void
    {
        $existing = EngineeringAITrend::where('company_id', $companyId)
            ->where('period_type', $type)->where('period_label', $label)->first();

        $dimScores = $review->scores()->get()->pluck('score', 'dimension')->toArray();

        if ($existing) {
            $count    = $existing->review_count + 1;
            $avgScore = (($existing->overall_score ?? 0) * ($count - 1) + ($review->overall_score ?? 0)) / $count;
            $existing->update([
                'overall_score'          => round($avgScore, 2),
                'dimension_scores'       => $dimScores,
                'review_count'           => $count,
                'risk_count'             => $existing->risk_count + $review->risk_count_critical + $review->risk_count_high,
                'recommendation_count'   => $existing->recommendation_count + $review->recommendations()->count(),
            ]);
        } else {
            EngineeringAITrend::create([
                'company_id'           => $companyId,
                'period_type'          => $type,
                'period_label'         => $label,
                'overall_score'        => $review->overall_score,
                'dimension_scores'     => $dimScores,
                'review_count'         => 1,
                'risk_count'           => $review->risk_count_critical + $review->risk_count_high,
                'recommendation_count' => $review->recommendations()->count(),
            ]);
        }
    }
}
