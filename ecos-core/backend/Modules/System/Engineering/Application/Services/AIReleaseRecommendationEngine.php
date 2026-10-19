<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Application\Services;

use Modules\System\Engineering\Domain\Models\EngineeringAIReview;
use Modules\System\Engineering\Domain\Models\EngineeringAIReleaseReview;
use Modules\System\Engineering\Domain\Models\EngineeringRelease;
use Modules\System\Engineering\Domain\Enums\ReviewRecommendation;

class AIReleaseRecommendationEngine
{
    public function evaluate(EngineeringAIReview $review): ReviewRecommendation
    {
        $hasCritical     = $review->risk_count_critical > 0;
        $overallScore    = $review->overall_score ?? 0;
        $recommendation  = ReviewRecommendation::fromScore($overallScore, $hasCritical);

        $review->update([
            'recommendation' => $recommendation,
            'justification'  => $this->justifyRecommendation($review, $recommendation),
        ]);

        return $recommendation;
    }

    public function generateReleaseReview(EngineeringAIReview $review, string $releaseId): EngineeringAIReleaseReview
    {
        $recommendation   = $this->evaluate($review);
        $blockingRisks    = $review->risks()->where('is_blocking', true)->count();
        $warningRisks     = $review->risks()->where('severity', 'high')->where('is_blocking', false)->count();
        $passedChecks     = $review->architectureChecks()->where('passed', true)->count()
                         + $review->securityChecks()->where('passed', true)->count();
        $failedChecks     = $review->architectureChecks()->where('passed', false)->count()
                         + $review->securityChecks()->where('passed', false)->count();

        return EngineeringAIReleaseReview::create([
            'company_id'           => $review->company_id,
            'review_id'            => $review->id,
            'release_id'           => $releaseId,
            'recommendation'       => $recommendation,
            'justification'        => $this->justifyRecommendation($review, $recommendation),
            'blocking_risks_count' => $blockingRisks,
            'warning_risks_count'  => $warningRisks,
            'passed_checks'        => $passedChecks,
            'failed_checks'        => $failedChecks,
            'is_blocking'          => $recommendation->isBlocking(),
            'score_at_review'      => $review->overall_score,
        ]);
    }

    public function isBlocking(EngineeringAIReview $review): bool
    {
        return $review->is_blocking || ($review->overall_score !== null && $review->overall_score < 40);
    }

    private function justifyRecommendation(EngineeringAIReview $review, ReviewRecommendation $rec): string
    {
        $score    = $review->overall_score ?? 0;
        $critical = $review->risk_count_critical;
        $high     = $review->risk_count_high;

        return match($rec) {
            ReviewRecommendation::Approve => sprintf(
                'Engineering score of %.1f%% meets the approval threshold (≥90%%). No critical risks detected.',
                $score
            ),
            ReviewRecommendation::ApproveWithWarnings => sprintf(
                'Engineering score of %.1f%% meets the warning threshold (≥75%%). %d high-severity risk(s) detected — review before releasing.',
                $score, $high
            ),
            ReviewRecommendation::NeedsReview => sprintf(
                'Engineering score of %.1f%% is below 75%%. %d high and %d critical risk(s) detected. A manual engineering review is required.',
                $score, $high, $critical
            ),
            ReviewRecommendation::Reject => sprintf(
                'Engineering score of %.1f%% is critically low (40–59%%). %d critical and %d high risks detected. Release is NOT recommended.',
                $score, $critical, $high
            ),
            ReviewRecommendation::CriticalBlock => sprintf(
                'CRITICAL BLOCK: %d critical risk(s) and engineering score of %.1f%% prevent this release from proceeding. Immediate remediation required.',
                $critical, $score
            ),
        };
    }
}
