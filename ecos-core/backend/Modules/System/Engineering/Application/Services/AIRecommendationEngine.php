<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Application\Services;

use Modules\System\Engineering\Domain\Models\EngineeringAIReview;
use Modules\System\Engineering\Domain\Models\EngineeringAIRisk;
use Modules\System\Engineering\Domain\Models\EngineeringAIRecommendation;
use Modules\System\Engineering\Domain\Enums\RiskSeverity;

class AIRecommendationEngine
{
    public function generateFromRisks(EngineeringAIReview $review, array $risks): array
    {
        $recommendations = [];

        foreach ($risks as $risk) {
            $rec = $this->riskToRecommendation($review, $risk);
            if ($rec) { $recommendations[] = $rec; }
        }

        // Always add general improvement recommendations
        $recommendations = array_merge($recommendations, $this->generateGeneralRecommendations($review));

        return $recommendations;
    }

    public function resolve(EngineeringAIRecommendation $rec, string $actorId): void
    {
        $rec->update([
            'is_resolved' => true,
            'resolved_by' => $actorId,
            'resolved_at' => now(),
        ]);
    }

    public function getOpenRecommendations(string $companyId): array
    {
        return EngineeringAIRecommendation::where('company_id', $companyId)
            ->where('is_resolved', false)
            ->orderByRaw("CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END")
            ->get()
            ->toArray();
    }

    private function riskToRecommendation(EngineeringAIReview $review, EngineeringAIRisk $risk): ?EngineeringAIRecommendation
    {
        $type     = $this->mapRiskToType($risk);
        $priority = $this->mapSeverityToPriority($risk->severity);

        return EngineeringAIRecommendation::create([
            'review_id'       => $review->id,
            'company_id'      => $review->company_id,
            'type'            => $type,
            'priority'        => $priority,
            'category'        => $risk->category,
            'title'           => "Fix: {$risk->title}",
            'description'     => $risk->recommendation,
            'effort_estimate' => $this->estimateEffort($risk),
        ]);
    }

    private function generateGeneralRecommendations(EngineeringAIReview $review): array
    {
        $recommendations = [];

        // Add a technical debt recommendation if score < 80
        if ($review->overall_score !== null && $review->overall_score < 80) {
            $recommendations[] = EngineeringAIRecommendation::create([
                'review_id'       => $review->id,
                'company_id'      => $review->company_id,
                'type'            => 'technical_debt',
                'priority'        => 'medium',
                'category'        => 'quality',
                'title'           => 'Address Engineering Score Below 80',
                'description'     => sprintf(
                    'Overall engineering score is %.1f%%. Review the lowest-scoring dimensions and address issues systematically before the next release cycle.',
                    $review->overall_score
                ),
                'effort_estimate' => 'high',
            ]);
        }

        // Future architecture improvement
        if ($review->risk_count_high > 2) {
            $recommendations[] = EngineeringAIRecommendation::create([
                'review_id'       => $review->id,
                'company_id'      => $review->company_id,
                'type'            => 'architecture_improvement',
                'priority'        => 'medium',
                'category'        => 'architecture',
                'title'           => 'Establish Risk Reduction Roadmap',
                'description'     => sprintf(
                    '%d high-severity risks were detected. Create a dedicated sprint to address recurring architectural and quality risks.',
                    $review->risk_count_high
                ),
                'effort_estimate' => 'very_high',
            ]);
        }

        return $recommendations;
    }

    private function mapRiskToType(EngineeringAIRisk $risk): string
    {
        if ($risk->is_blocking) return 'immediate_fix';
        return match($risk->category) {
            'architecture' => 'architecture_improvement',
            'security'     => 'security_improvement',
            'performance'  => 'performance_improvement',
            'documentation'=> 'documentation_improvement',
            'testing'      => 'suggested_improvement',
            'dependency'   => 'immediate_fix',
            default        => 'suggested_improvement',
        };
    }

    private function mapSeverityToPriority(RiskSeverity $severity): string
    {
        return match($severity) {
            RiskSeverity::Critical      => 'critical',
            RiskSeverity::High          => 'high',
            RiskSeverity::Medium        => 'medium',
            RiskSeverity::Low, RiskSeverity::Informational => 'low',
        };
    }

    private function estimateEffort(EngineeringAIRisk $risk): string
    {
        return match($risk->severity) {
            RiskSeverity::Critical      => 'high',
            RiskSeverity::High          => 'medium',
            RiskSeverity::Medium        => 'low',
            RiskSeverity::Low           => 'trivial',
            RiskSeverity::Informational => 'trivial',
        };
    }
}
