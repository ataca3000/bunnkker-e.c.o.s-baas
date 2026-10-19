<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Application\Services;

use Illuminate\Pagination\LengthAwarePaginator;
use Modules\System\Engineering\Domain\Models\EngineeringAIArchitectureCheck;
use Modules\System\Engineering\Domain\Models\EngineeringAIReview;
use Modules\System\Engineering\Domain\Models\EngineeringAIRisk;
use Modules\System\Engineering\Domain\Models\EngineeringAISecurityCheck;
use Modules\System\Engineering\Domain\Models\EngineeringRelease;
use Modules\System\Engineering\Domain\Enums\ReviewStatus;
use Modules\System\Engineering\Domain\Enums\ReviewRecommendation;

class AIReviewEngine
{
    public function __construct(
        private readonly AIScoringEngine                $scoringEngine,
        private readonly AIRiskEngine                   $riskEngine,
        private readonly AIRecommendationEngine         $recommendationEngine,
        private readonly AIADRValidationEngine          $adrEngine,
        private readonly AISecurityCheckEngine          $securityEngine,
        private readonly AITrendEngine                  $trendEngine,
        private readonly AILearningEngine               $learningEngine,
        private readonly AIMetricsEngine                $metricsEngine,
        private readonly AIReleaseRecommendationEngine  $releaseRecEngine,
    ) {}

    public function create(string $companyId, string $reviewType = 'manual', ?string $subjectType = null, ?string $subjectId = null, ?string $triggeredBy = null): EngineeringAIReview
    {
        return EngineeringAIReview::create([
            'company_id'   => $companyId,
            'review_type'  => $reviewType,
            'status'       => ReviewStatus::Pending,
            'subject_type' => $subjectType,
            'subject_id'   => $subjectId,
            'triggered_by' => $triggeredBy,
            'triggered_at' => now(),
        ]);
    }

    public function run(EngineeringAIReview $review): EngineeringAIReview
    {
        if ($review->isTerminal()) {
            return $review;
        }

        $review->update(['status' => ReviewStatus::Running, 'started_at' => now()]);

        try {
            // 1. ADR compliance checks
            $this->adrEngine->runAll($review);
            $review->load('architectureChecks');

            // 2. Security checks
            $this->securityEngine->runAll($review);
            $review->load('securityChecks');

            // 3. Risk analysis
            $risks = $this->riskEngine->runAll($review);
            $review->refresh();

            // 4. Score all dimensions
            $this->scoringEngine->calculateAll($review);
            $review->load('scores');

            // 5. Compute overall weighted score and update review
            $overall = $this->scoringEngine->updateReviewScore($review);
            $review->refresh();

            // 6. Release recommendation
            $recommendation = $this->releaseRecEngine->evaluate($review);
            $review->refresh();

            // 7. Generate recommendations from risks
            $this->recommendationEngine->generateFromRisks($review, $review->risks()->get()->all());

            // 8. Generate summary
            $summary = $this->generateSummary($review);
            $review->update([
                'status'       => ReviewStatus::Completed,
                'completed_at' => now(),
                'summary'      => $summary,
            ]);

            $review->refresh();

            // 9. Record in learning, trends, metrics (no failure allowed here)
            try {
                $this->learningEngine->recordReview($review);
                $this->trendEngine->recordSnapshot($review);
                $this->metricsEngine->record($review->company_id, 'score', 'overall', $review->overall_score ?? 0);
                $this->metricsEngine->record($review->company_id, 'risks', 'critical', $review->risk_count_critical);
            } catch (Throwable) {}

        } catch (Throwable $e) {
            $review->update([
                'status'       => ReviewStatus::Failed,
                'completed_at' => now(),
                'summary'      => 'Review failed: ' . $e->getMessage(),
            ]);
        }

        return $review->fresh(['scores', 'risks', 'recommendations', 'architectureChecks', 'securityChecks']);
    }

    public function cancel(EngineeringAIReview $review): void
    {
        if (!$review->isTerminal()) {
            $review->update(['status' => ReviewStatus::Cancelled, 'completed_at' => now()]);
        }
    }

    public function getResults(EngineeringAIReview $review): array
    {
        return [
            'review'              => $review->load(['scores', 'risks', 'recommendations', 'architectureChecks', 'securityChecks']),
            'adr_compliance'      => $this->adrEngine->getComplianceSummary($review),
            'release_reviews'     => $review->releaseReviews()->get(),
        ];
    }

    public function getDashboard(string $companyId): array
    {
        $latestReview    = EngineeringAIReview::where('company_id', $companyId)
            ->where('status', ReviewStatus::Completed->value)
            ->with(['scores', 'risks'])
            ->latest()->first();

        $recentReviews   = EngineeringAIReview::where('company_id', $companyId)
            ->with(['scores'])->latest()->limit(10)->get();

        $trend           = $this->trendEngine->getDailyTrend($companyId, 30);
        $openRecs        = $this->recommendationEngine->getOpenRecommendations($companyId);
        $criticalRisks   = EngineeringAIRisk
            ::where('company_id', $companyId)->where('severity', 'critical')->where('is_acknowledged', false)->get();

        $archChecks      = EngineeringAIArchitectureCheck
            ::whereHas('review', fn($q) => $q->where('company_id', $companyId)->where('status', 'completed'))
            ->latest('id')->limit(100)->get();
        $archRate        = $archChecks->isNotEmpty()
            ? round(($archChecks->where('passed', true)->count() / $archChecks->count()) * 100, 2) : 100;

        $secChecks       = EngineeringAISecurityCheck
            ::whereHas('review', fn($q) => $q->where('company_id', $companyId)->where('status', 'completed'))
            ->latest('id')->limit(100)->get();
        $secRate         = $secChecks->isNotEmpty()
            ? round(($secChecks->where('passed', true)->count() / $secChecks->count()) * 100, 2) : 100;

        return [
            'latest_review'             => $latestReview,
            'overall_score'             => $latestReview?->overall_score,
            'recommendation'            => $latestReview?->recommendation?->value,
            'scores_by_dimension'       => $latestReview?->scores ?? [],
            'critical_risks'            => $criticalRisks,
            'open_recommendations'      => $openRecs,
            'recent_reviews'            => $recentReviews,
            'trend_30d'                 => $trend,
            'review_count_total'        => EngineeringAIReview::where('company_id', $companyId)->count(),
            'review_count_this_month'   => EngineeringAIReview::where('company_id', $companyId)->where('created_at', '>=', now()->startOfMonth())->count(),
            'architecture_compliance_rate' => $archRate,
            'security_pass_rate'           => $secRate,
        ];
    }

    public function listReviews(string $companyId, array $filters = []): LengthAwarePaginator
    {
        $query = EngineeringAIReview::where('company_id', $companyId);
        if (!empty($filters['status']))      $query->where('status', $filters['status']);
        if (!empty($filters['review_type'])) $query->where('review_type', $filters['review_type']);
        if (!empty($filters['recommendation'])) $query->where('recommendation', $filters['recommendation']);
        return $query->latest()->paginate($filters['per_page'] ?? 15);
    }

    private function generateSummary(EngineeringAIReview $review): string
    {
        return sprintf(
            'Engineering review completed. Score: %.1f%%. Recommendation: %s. Risks: %d critical, %d high, %d medium. Architecture compliance: %d/%d checks passed.',
            $review->overall_score ?? 0,
            $review->recommendation?->label() ?? 'N/A',
            $review->risk_count_critical,
            $review->risk_count_high,
            $review->risk_count_medium,
            $review->architectureChecks()->where('passed', true)->count(),
            $review->architectureChecks()->count(),
        );
    }
}
