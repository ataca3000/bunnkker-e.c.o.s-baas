<?php

declare(strict_types=1);

namespace Modules\Crm\Intelligence\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Crm\Intelligence\Domain\Enums\ChurnRiskBand;
use Modules\Crm\Intelligence\Domain\Enums\HealthBand;
use Modules\Crm\Intelligence\Domain\Enums\InsightSeverity;
use Modules\Crm\Intelligence\Domain\Enums\LifecycleStage;
use Modules\Crm\Intelligence\Domain\Enums\RfmSegment;
use Modules\Crm\Intelligence\Domain\Models\CustomerInsight;
use Modules\Crm\Intelligence\Domain\Models\CustomerIntelligenceProfile;
use Modules\Crm\Intelligence\Domain\Models\CustomerRecommendation;

/**
 * The orchestrator — turns immutable purchase facts into an explainable profile.
 *
 * For each customer it runs every deterministic engine (RFM → value → churn →
 * health → lifecycle), persists the snapshot with its full explanation, then
 * regenerates the rule-based recommendations and insights. Recomputation is
 * idempotent: the same facts always produce the same profile.
 */
final class CustomerIntelligenceService
{
    public function __construct(
        private readonly PurchaseFactService $facts,
        private readonly RfmAnalysisService $rfm,
        private readonly CustomerValueService $value,
        private readonly ChurnRiskService $churn,
        private readonly HealthScoreService $health,
        private readonly RecommendationEngine $recommendations,
    ) {}

    /**
     * Recompute every customer with purchase facts for a company.
     *
     * @return int number of profiles computed
     */
    public function recomputeCompany(string $companyId, ?Carbon $asOf = null): int
    {
        $asOf ??= Carbon::now();
        $customerIds = DB::table('crm_customer_purchase_facts')
            ->where('company_id', $companyId)
            ->distinct()->pluck('customer_id')->all();

        if ($customerIds === []) {
            return 0;
        }

        // Aggregate every customer once, then build the cohort the quintiles rank against.
        $aggregates = [];
        foreach ($customerIds as $id) {
            $aggregates[$id] = $this->facts->aggregates((string) $id, $asOf);
        }
        $cohort = $this->buildCohort($aggregates);

        foreach ($customerIds as $id) {
            $this->persist($companyId, (string) $id, $aggregates[$id], $cohort, $asOf);
        }

        return count($customerIds);
    }

    /** Recompute a single customer (cohort is drawn from the whole company). */
    public function recomputeCustomer(string $companyId, string $customerId, ?Carbon $asOf = null): CustomerIntelligenceProfile
    {
        $asOf ??= Carbon::now();

        $customerIds = DB::table('crm_customer_purchase_facts')
            ->where('company_id', $companyId)
            ->distinct()->pluck('customer_id')->all();

        $aggregates = [];
        foreach ($customerIds as $id) {
            $aggregates[(string) $id] = $this->facts->aggregates((string) $id, $asOf);
        }
        $aggregates[$customerId] ??= $this->facts->aggregates($customerId, $asOf);

        $cohort = $this->buildCohort($aggregates);

        return $this->persist($companyId, $customerId, $aggregates[$customerId], $cohort, $asOf);
    }

    /**
     * @param  array<string, array<string, mixed>>  $aggregates
     * @return array{recency: array<int,float>, frequency: array<int,float>, monetary: array<int,float>}
     */
    private function buildCohort(array $aggregates): array
    {
        $cohort = ['recency' => [], 'frequency' => [], 'monetary' => []];
        foreach ($aggregates as $agg) {
            if ((int) $agg['frequency'] === 0) {
                continue;
            }
            $cohort['recency'][] = (float) $agg['recency_days'];
            $cohort['frequency'][] = (float) $agg['frequency'];
            $cohort['monetary'][] = (float) $agg['monetary'];
        }

        return $cohort;
    }

    /**
     * @param  array<string, mixed>  $agg
     * @param  array{recency: array<int,float>, frequency: array<int,float>, monetary: array<int,float>}  $cohort
     */
    private function persist(string $companyId, string $customerId, array $agg, array $cohort, Carbon $asOf): CustomerIntelligenceProfile
    {
        $rfm = $this->rfm->evaluate([
            'recency_days' => $agg['recency_days'],
            'frequency' => (int) $agg['frequency'],
            'monetary' => (float) $agg['monetary'],
        ], $cohort);

        $value = $this->value->evaluate($agg);
        $churn = $this->churn->evaluate($agg);
        $health = $this->health->evaluate([
            'recency_score' => $rfm['recency_score'],
            'frequency_score' => $rfm['frequency_score'],
            'monetary_score' => $rfm['monetary_score'],
        ], (int) $agg['tenure_days']);

        /** @var RfmSegment $segment */
        $segment = $rfm['segment'];
        /** @var ChurnRiskBand $churnBand */
        $churnBand = $churn['band'];
        /** @var HealthBand $healthBand */
        $healthBand = $health['band'];
        $lifecycle = LifecycleStage::derive((int) $agg['frequency'], $churnBand);

        $isRepeat = (int) $agg['frequency'] >= 2;
        $isRetained = (int) $agg['frequency'] >= 1 && ! $churnBand->needsIntervention();

        $profile = CustomerIntelligenceProfile::updateOrCreate(
            ['company_id' => $companyId, 'customer_id' => $customerId],
            [
                'recency_days' => $agg['recency_days'],
                'frequency' => (int) $agg['frequency'],
                'monetary' => (float) $agg['monetary'],
                'recency_score' => $rfm['recency_score'],
                'frequency_score' => $rfm['frequency_score'],
                'monetary_score' => $rfm['monetary_score'],
                'rfm_segment' => $segment->value,
                'average_order_value' => $value['average_order_value'],
                'lifetime_value' => $value['lifetime_value'],
                'predicted_lifetime_value' => $value['predicted_lifetime_value'],
                'purchase_frequency_monthly' => $value['purchase_frequency_monthly'],
                'avg_interval_days' => $agg['avg_interval_days'],
                'tenure_days' => (int) $agg['tenure_days'],
                'churn_risk_score' => $churn['score'],
                'churn_risk_band' => $churnBand->value,
                'health_score' => $health['score'],
                'health_band' => $healthBand->value,
                'segment' => $segment->value,
                'lifecycle_stage' => $lifecycle->value,
                'is_repeat' => $isRepeat,
                'is_retained' => $isRetained,
                'first_purchase_at' => $agg['first_at'],
                'last_purchase_at' => $agg['last_at'],
                'explanation' => [
                    'rfm' => $rfm['explanation'],
                    'value' => $value['explanation'],
                    'churn' => $churn['explanation'],
                    'health' => $health['explanation'],
                    'lifecycle' => ['stage' => $lifecycle->value, 'from' => 'orders + churn band'],
                ],
                'computed_at' => $asOf,
            ]
        );

        $profileData = [
            'rfm_segment' => $segment,
            'churn_risk_band' => $churnBand,
            'health_band' => $healthBand,
            'frequency' => (int) $agg['frequency'],
            'monetary_score' => $rfm['monetary_score'],
            'recency_days' => $agg['recency_days'],
        ];

        $this->regenerateRecommendations($companyId, $customerId, $profileData, $asOf);
        $this->regenerateInsights($companyId, $customerId, $segment, $churnBand, $healthBand, $agg, $rfm, $asOf);

        return $profile;
    }

    private function regenerateRecommendations(string $companyId, string $customerId, array $profileData, Carbon $asOf): void
    {
        // Replace only open (system-generated) recommendations; keep actioned/dismissed history.
        CustomerRecommendation::where('company_id', $companyId)
            ->where('customer_id', $customerId)->where('status', 'open')->delete();

        foreach ($this->recommendations->generate($profileData) as $rec) {
            CustomerRecommendation::create([
                'company_id' => $companyId,
                'customer_id' => $customerId,
                'type' => $rec['type']->value,
                'rule_key' => $rec['rule_key'],
                'title' => $rec['title'],
                'rationale' => $rec['rationale'],
                'priority' => $rec['priority'],
                'status' => 'open',
                'context' => $rec['context'],
                'generated_at' => $asOf,
            ]);
        }
    }

    private function regenerateInsights(
        string $companyId,
        string $customerId,
        RfmSegment $segment,
        ChurnRiskBand $churnBand,
        HealthBand $healthBand,
        array $agg,
        array $rfm,
        Carbon $asOf,
    ): void {
        CustomerInsight::where('company_id', $companyId)->where('customer_id', $customerId)->delete();

        $insights = [];

        if ($segment === RfmSegment::Champions) {
            $insights[] = ['champion', InsightSeverity::Positive, 'segment_champion', 'Champion customer', 'Recent, frequent and high-spend — one of the best customers.', 'monetary', (float) $agg['monetary']];
        }

        if (in_array($segment, [RfmSegment::AtRisk, RfmSegment::CantLose], true)) {
            $insights[] = ['high_value_at_risk', InsightSeverity::Critical, 'high_value_at_risk', 'High-value customer at risk', 'Historically valuable but has not purchased recently.', 'recency_days', (float) ($agg['recency_days'] ?? 0)];
        }

        if ($churnBand->needsIntervention() && ! in_array($segment, [RfmSegment::AtRisk, RfmSegment::CantLose], true)) {
            $insights[] = ['churn_rising', InsightSeverity::Warning, 'churn_rising', 'Churn risk is rising', "Churn band is {$churnBand->label()}.", 'churn_band', null];
        }

        if ((int) $agg['frequency'] === 1) {
            $insights[] = ['first_purchase', InsightSeverity::Info, 'first_purchase', 'New customer', 'First and only purchase so far.', 'frequency', 1.0];
        }

        if ($healthBand === HealthBand::Thriving) {
            $insights[] = ['thriving', InsightSeverity::Positive, 'thriving_health', 'Thriving relationship', 'Overall customer health is excellent.', 'health', null];
        }

        foreach ($insights as [$type, $severity, $ruleKey, $title, $detail, $metricKey, $metricValue]) {
            CustomerInsight::create([
                'company_id' => $companyId,
                'customer_id' => $customerId,
                'type' => $type,
                'severity' => $severity->value,
                'rule_key' => $ruleKey,
                'title' => $title,
                'detail' => $detail,
                'metric_key' => $metricKey,
                'metric_value' => $metricValue,
                'generated_at' => $asOf,
            ]);
        }
    }
}
