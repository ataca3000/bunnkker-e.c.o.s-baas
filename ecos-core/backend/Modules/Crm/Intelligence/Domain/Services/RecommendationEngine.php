<?php

declare(strict_types=1);

namespace Modules\Crm\Intelligence\Domain\Services;

use Modules\Crm\Intelligence\Domain\Enums\ChurnRiskBand;
use Modules\Crm\Intelligence\Domain\Enums\RecommendationType;
use Modules\Crm\Intelligence\Domain\Enums\RfmSegment;
use Modules\Crm\Intelligence\Domain\Support\IntelligenceWeights;

/**
 * Rule-based next-best-action engine — deterministic, no generative AI.
 *
 * Each rule is a plain predicate over the intelligence profile; when it fires it
 * emits a recommendation carrying its own rule key and a human-readable rationale.
 * The same profile always yields the same, explainable set of actions.
 */
final class RecommendationEngine
{
    /**
     * @param  array<string, mixed>  $profile  a computed profile (see CustomerIntelligenceService)
     * @return array<int, array<string, mixed>>
     */
    public function generate(array $profile): array
    {
        $segment = $profile['rfm_segment'] instanceof RfmSegment ? $profile['rfm_segment'] : null;
        $churn = $profile['churn_risk_band'] instanceof ChurnRiskBand ? $profile['churn_risk_band'] : null;
        $frequency = (int) ($profile['frequency'] ?? 0);
        $monetaryScore = (int) ($profile['monetary_score'] ?? 0);
        $recencyDays = $profile['recency_days'];

        $out = [];

        // Critical/high churn → retention outreach (the highest priority rule).
        if ($churn?->needsIntervention()) {
            $out[] = $this->rec(
                RecommendationType::Retention, 'churn_retention',
                'Reach out — churn risk is elevated',
                "Churn band is {$churn->label()}; contact the customer before the relationship lapses.",
                $churn === ChurnRiskBand::Critical ? 95 : 80,
                ['churn_band' => $churn->value],
            );
        }

        // Champions → VIP treatment.
        if ($segment === RfmSegment::Champions) {
            $out[] = $this->rec(
                RecommendationType::VipTreatment, 'champion_vip',
                'Give VIP treatment to a champion',
                'Recent, frequent, high-spend customer — reward and retain with premium service.',
                70, ['segment' => $segment->value],
            );
        }

        // Loyal → loyalty enrollment.
        if ($segment === RfmSegment::LoyalCustomers) {
            $out[] = $this->rec(
                RecommendationType::LoyaltyEnrollment, 'loyal_enroll',
                'Enroll a loyal customer in the rewards program',
                'Buys regularly — a loyalty program deepens the relationship.',
                55, ['segment' => $segment->value],
            );
        }

        // High-value but lapsed → win back.
        if (in_array($segment, [RfmSegment::AtRisk, RfmSegment::CantLose], true)) {
            $out[] = $this->rec(
                RecommendationType::WinBack, 'high_value_winback',
                'Win back a high-value customer',
                'Spent significantly in the past but has not returned — a targeted win-back offer is warranted.',
                85, ['segment' => $segment->value],
            );
        }

        // Dormant/lost → reactivation.
        if (in_array($segment, [RfmSegment::Hibernating, RfmSegment::Lost, RfmSegment::AboutToSleep], true)) {
            $out[] = $this->rec(
                RecommendationType::Reactivation, 'dormant_reactivation',
                'Reactivate a dormant customer',
                'Low recency and frequency — a reactivation campaign may re-engage them.',
                50, ['segment' => $segment->value],
            );
        }

        // New customers → onboarding.
        if ($segment === RfmSegment::NewCustomers) {
            $out[] = $this->rec(
                RecommendationType::Onboarding, 'new_onboarding',
                'Onboard a new customer',
                'First purchase made recently — an onboarding touch encourages a second order.',
                45, ['segment' => $segment->value],
            );
        }

        // Single purchase, gone quiet → second-purchase nudge.
        if ($frequency === 1 && $recencyDays !== null && $recencyDays >= IntelligenceWeights::SECOND_PURCHASE_NUDGE_DAYS) {
            $out[] = $this->rec(
                RecommendationType::Reactivation, 'second_purchase_nudge',
                'Nudge toward a second purchase',
                "One purchase, {$recencyDays} days ago — prompt the important second order.",
                40, ['recency_days' => $recencyDays],
            );
        }

        // High monetary + repeat → cross-sell.
        if ($frequency >= 2 && $monetaryScore >= IntelligenceWeights::HIGH_VALUE_MONETARY_SCORE) {
            $out[] = $this->rec(
                RecommendationType::CrossSell, 'high_value_crosssell',
                'Cross-sell to a high-value repeat buyer',
                'Repeat, high-spend customer — recommend complementary products.',
                48, ['monetary_score' => $monetaryScore],
            );
        }

        return $out;
    }

    private function rec(RecommendationType $type, string $ruleKey, string $title, string $rationale, int $priority, array $context): array
    {
        return [
            'type' => $type,
            'rule_key' => $ruleKey,
            'title' => $title,
            'rationale' => $rationale,
            'priority' => $priority,
            'context' => $context,
        ];
    }
}
