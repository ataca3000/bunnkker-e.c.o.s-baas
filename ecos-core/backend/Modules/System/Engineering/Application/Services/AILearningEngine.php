<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Application\Services;

use Modules\System\Engineering\Domain\Models\EngineeringAIReview;
use Modules\System\Engineering\Domain\Models\EngineeringAIHistory;
use Modules\System\Engineering\Domain\Models\EngineeringAIRisk;

class AILearningEngine
{
    public function recordReview(EngineeringAIReview $review): EngineeringAIHistory
    {
        return EngineeringAIHistory::create([
            'company_id'     => $review->company_id,
            'review_id'      => $review->id,
            'subject_type'   => $review->subject_type,
            'subject_id'     => $review->subject_id,
            'overall_score'  => $review->overall_score,
            'recommendation' => $review->recommendation?->value,
            'risk_summary'   => [
                'critical' => $review->risk_count_critical,
                'high'     => $review->risk_count_high,
                'medium'   => $review->risk_count_medium,
                'low'      => $review->risk_count_low,
            ],
            'occurred_at'    => now(),
        ]);
    }

    public function getRecurringIssues(string $companyId, int $days = 30): array
    {
        return EngineeringAIRisk::where('company_id', $companyId)
            ->where('created_at', '>=', now()->subDays($days))
            ->selectRaw('title, category, severity, COUNT(*) as occurrences')
            ->groupBy('title', 'category', 'severity')
            ->having('occurrences', '>', 1)
            ->orderByDesc('occurrences')
            ->get()->toArray();
    }

    public function getCommonMistakes(string $companyId): array
    {
        return EngineeringAIRisk::where('company_id', $companyId)
            ->selectRaw('category, COUNT(*) as total_count, SUM(CASE WHEN severity = ? THEN 1 ELSE 0 END) as critical_count', ['critical'])
            ->groupBy('category')
            ->orderByDesc('total_count')
            ->get()->toArray();
    }

    public function analyzePatterns(string $companyId): array
    {
        $history     = EngineeringAIHistory::where('company_id', $companyId)->orderByDesc('occurred_at')->limit(20)->get();
        $avgScore    = $history->avg('overall_score') ?? 0;
        $trending    = $this->computeTrend($history->pluck('overall_score')->filter()->values()->toArray());
        return [
            'avg_score'          => round($avgScore, 2),
            'trend'              => $trending,
            'review_count'       => $history->count(),
            'last_recommendation'=> $history->first()?->recommendation,
        ];
    }

    public function getImprovementHistory(string $companyId, int $limit = 50): array
    {
        return EngineeringAIHistory::where('company_id', $companyId)
            ->orderByDesc('occurred_at')->limit($limit)->get()->toArray();
    }

    private function computeTrend(array $scores): string
    {
        if (count($scores) < 2) return 'insufficient_data';
        $half    = intdiv(count($scores), 2);
        $recent  = array_sum(array_slice($scores, 0, $half)) / $half;
        $older   = array_sum(array_slice($scores, $half)) / $half;
        if ($recent > $older + 5) return 'improving';
        if ($recent < $older - 5) return 'declining';
        return 'stable';
    }
}
