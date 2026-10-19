<?php

declare(strict_types=1);

namespace Tests\Feature\Crm;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Carbon;
use Modules\Crm\Customers\Domain\Enums\CustomerType;
use Modules\Crm\Customers\Domain\Models\Customer;
use Modules\Crm\Customers\Domain\Services\CustomerService;
use Modules\Crm\Intelligence\Domain\Enums\ChurnRiskBand;
use Modules\Crm\Intelligence\Domain\Enums\RfmSegment;
use Modules\Crm\Intelligence\Domain\Models\CustomerRecommendation;
use Modules\Crm\Intelligence\Domain\Models\PurchaseFact;
use Modules\Crm\Intelligence\Domain\Services\CustomerAnalyticsService;
use Modules\Crm\Intelligence\Domain\Services\CustomerIntelligenceService;
use Modules\Crm\Intelligence\Domain\Services\PurchaseFactService;
use Modules\Crm\Intelligence\Domain\Services\RfmAnalysisService;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * CRM & Customer Service OS — EPIC C5. Customer Intelligence.
 *
 * Protects the guarantees that matter for a DETERMINISTIC, EXPLAINABLE analytics
 * layer: append-only facts, quintile RFM, explainable CLV/health/churn formulas,
 * rule-based (never generative) recommendations, and integration by reference.
 */
class CustomerIntelligenceTest extends TestCase
{
    use DatabaseTransactions;

    private string $companyId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->companyId = (string) Company::factory()->create()->id;
    }

    private function newCustomer(string $name): Customer
    {
        return app(CustomerService::class)->create(
            $this->companyId, CustomerType::Individual, ['first_name' => $name, 'last_name' => 'T']
        );
    }

    /** @param array<int, array{0:int,1:float}> $orders [daysAgo, amount] */
    private function seedOrders(Customer $customer, array $orders): void
    {
        $i = 0;
        foreach ($orders as [$daysAgo, $amount]) {
            app(PurchaseFactService::class)->record($this->companyId, (string) $customer->id, [
                'source_reference' => 'ord-'.$customer->id.'-'.($i++),
                'amount' => $amount,
                'occurred_at' => Carbon::now()->subDays($daysAgo),
            ]);
        }
    }

    // ═══ PURCHASE FACTS ══════════════════════════════════════════════════════════

    public function test_purchase_facts_are_idempotent_by_reference(): void
    {
        $c = $this->newCustomer('Ada');
        $facts = app(PurchaseFactService::class);
        $facts->record($this->companyId, (string) $c->id, ['source_reference' => 'ord-1', 'amount' => 100]);
        $facts->record($this->companyId, (string) $c->id, ['source_reference' => 'ord-1', 'amount' => 100]);

        $this->assertSame(1, PurchaseFact::where('customer_id', $c->id)->count());
    }

    public function test_purchase_facts_are_append_only(): void
    {
        $c = $this->newCustomer('Ada');
        $this->seedOrders($c, [[10, 100]]);
        $fact = PurchaseFact::where('customer_id', $c->id)->firstOrFail();

        $fact->amount = 999;
        $this->assertFalse($fact->save());
        $this->assertFalse($fact->delete());
    }

    // ═══ RFM ═════════════════════════════════════════════════════════════════════

    public function test_rfm_quintile_scoring_is_deterministic(): void
    {
        $rfm = app(RfmAnalysisService::class);
        $cohort = [1.0, 2.0, 3.0, 4.0, 5.0];

        $this->assertSame(5, $rfm->score(5.0, $cohort, higherIsBetter: true));
        $this->assertSame(1, $rfm->score(1.0, $cohort, higherIsBetter: true));
        $this->assertSame(3, $rfm->score(3.0, $cohort, higherIsBetter: true));
        // Recency is inverted: the smallest "days since" is the best score.
        $this->assertSame(5, $rfm->score(1.0, $cohort, higherIsBetter: false));
        $this->assertSame(1, $rfm->score(5.0, $cohort, higherIsBetter: false));
    }

    public function test_best_customer_in_the_cohort_is_a_champion(): void
    {
        $champion = $this->newCustomer('Champ');
        $this->seedOrders($champion, [[1, 2000], [3, 1500], [6, 1800], [9, 1200], [12, 1600]]);
        foreach (['a', 'b', 'c', 'd'] as $n) {
            $this->seedOrders($this->newCustomer($n), [[320, 50]]);
        }

        app(CustomerIntelligenceService::class)->recomputeCompany($this->companyId);

        $profile = $this->profileFor($champion);
        $this->assertSame(RfmSegment::Champions, $profile->rfm_segment);
        $this->assertSame(5, $profile->recency_score);
        $this->assertSame(5, $profile->frequency_score);
    }

    // ═══ VALUE / CLV ═════════════════════════════════════════════════════════════

    public function test_clv_projection_is_explainable(): void
    {
        $c = $this->newCustomer('Val');
        $this->seedOrders($c, [[120, 100], [80, 100], [40, 100], [10, 100]]);
        app(CustomerIntelligenceService::class)->recomputeCustomer($this->companyId, (string) $c->id);

        $p = $this->profileFor($c);
        $this->assertSame(400.0, (float) $p->lifetime_value);       // historical = money spent
        $this->assertSame(100.0, (float) $p->average_order_value);

        $exp = $p->explanation['value'];
        $expected = round(100.0 * (float) $exp['annual_orders'] * $exp['horizon_years'], 2);
        $this->assertSame($expected, (float) $p->predicted_lifetime_value);
        $this->assertSame('predicted = average_order_value × annual_orders × horizon_years', $exp['formula']);
    }

    public function test_purchase_frequency_is_computed(): void
    {
        $c = $this->newCustomer('Freq');
        $this->seedOrders($c, [[60, 100], [30, 100], [0, 100]]);
        app(CustomerIntelligenceService::class)->recomputeCustomer($this->companyId, (string) $c->id);

        $p = $this->profileFor($c);
        $this->assertSame(30, $p->avg_interval_days);          // 60-day span / 2 gaps
        $this->assertGreaterThan(0, (float) $p->purchase_frequency_monthly);
    }

    // ═══ CHURN ═══════════════════════════════════════════════════════════════════

    public function test_churn_risk_rises_when_overdue_against_cadence(): void
    {
        $overdue = $this->newCustomer('Overdue');   // 10-day cadence, silent for 90 days
        $this->seedOrders($overdue, [[120, 100], [110, 100], [100, 100], [90, 100]]);

        $onTrack = $this->newCustomer('OnTrack');    // 10-day cadence, last order 5 days ago
        $this->seedOrders($onTrack, [[35, 100], [25, 100], [15, 100], [5, 100]]);

        $svc = app(CustomerIntelligenceService::class);
        $svc->recomputeCustomer($this->companyId, (string) $overdue->id);
        $svc->recomputeCustomer($this->companyId, (string) $onTrack->id);

        $overdueProfile = $this->profileFor($overdue);
        $onTrackProfile = $this->profileFor($onTrack);

        $this->assertGreaterThan($onTrackProfile->churn_risk_score, $overdueProfile->churn_risk_score);
        $this->assertSame(ChurnRiskBand::Critical, $overdueProfile->churn_risk_band);
        $this->assertSame(ChurnRiskBand::Low, $onTrackProfile->churn_risk_band);
    }

    // ═══ HEALTH ══════════════════════════════════════════════════════════════════

    public function test_health_score_is_bounded_and_explainable(): void
    {
        $c = $this->newCustomer('Health');
        $this->seedOrders($c, [[20, 500], [10, 400], [2, 600]]);
        app(CustomerIntelligenceService::class)->recomputeCustomer($this->companyId, (string) $c->id);

        $p = $this->profileFor($c);
        $this->assertGreaterThanOrEqual(0, $p->health_score);
        $this->assertLessThanOrEqual(100, $p->health_score);

        $health = $p->explanation['health'];
        $this->assertArrayHasKey('recency', $health['components']);
        $this->assertArrayHasKey('tenure', $health['components']);
        $this->assertEqualsWithDelta(1.0, array_sum($health['weights']), 0.0001);
    }

    // ═══ SEGMENTATION / RECOMMENDATIONS ══════════════════════════════════════════

    public function test_high_value_lapsed_customer_gets_a_win_back_recommendation(): void
    {
        $lapsed = $this->newCustomer('Lapsed');
        $this->seedOrders($lapsed, [[430, 2000], [420, 1800], [410, 2200], [400, 1600]]);
        foreach (['x', 'y', 'z'] as $n) {
            $this->seedOrders($this->newCustomer($n), [[4, 80]]);
        }

        app(CustomerIntelligenceService::class)->recomputeCompany($this->companyId);

        $profile = $this->profileFor($lapsed);
        $this->assertContains($profile->rfm_segment, [RfmSegment::AtRisk, RfmSegment::CantLose]);

        $this->assertTrue(
            CustomerRecommendation::where('customer_id', $lapsed->id)->where('rule_key', 'high_value_winback')->exists(),
            'A deterministic win-back recommendation should fire for a high-value lapsed customer.'
        );
    }

    public function test_recommendations_are_regenerated_deterministically(): void
    {
        $c = $this->newCustomer('Det');
        $this->seedOrders($c, [[400, 1000], [380, 1200]]);
        $svc = app(CustomerIntelligenceService::class);

        $svc->recomputeCustomer($this->companyId, (string) $c->id);
        $first = $this->profileFor($c);
        $firstCount = CustomerRecommendation::where('customer_id', $c->id)->count();

        $svc->recomputeCustomer($this->companyId, (string) $c->id);
        $second = $this->profileFor($c);

        $this->assertSame($first->health_score, $second->health_score);
        $this->assertSame($first->churn_risk_score, $second->churn_risk_score);
        $this->assertSame($first->rfm_segment, $second->rfm_segment);
        // Open recommendations are replaced, not duplicated.
        $this->assertSame($firstCount, CustomerRecommendation::where('customer_id', $c->id)->count());
    }

    // ═══ ANALYTICS / RETENTION ═══════════════════════════════════════════════════

    public function test_portfolio_analytics_and_retention_are_counted(): void
    {
        $this->seedOrders($this->newCustomer('Repeat'), [[20, 100], [5, 100]]);
        $this->seedOrders($this->newCustomer('Single'), [[8, 100]]);
        app(CustomerIntelligenceService::class)->recomputeCompany($this->companyId);

        $overview = app(CustomerAnalyticsService::class)->overview($this->companyId);
        $this->assertSame(2, $overview['customers']);
        $this->assertSame(300.0, (float) $overview['total_lifetime_value']);   // (100+100) + 100

        $retention = $overview['retention'];
        $this->assertSame(2, $retention['customers']);
        $this->assertSame(1, $retention['repeat_customers']);
        $this->assertSame(0.5, $retention['repeat_purchase_rate']);
    }

    // ═══ SECURITY & ARCHITECTURE ═════════════════════════════════════════════════

    public function test_intelligence_routes_require_authentication(): void
    {
        $this->getJson('/api/crm/intelligence/profiles')->assertUnauthorized();
        $this->getJson('/api/crm/intelligence/analytics')->assertUnauthorized();
    }

    public function test_module_integrates_by_reference_only(): void
    {
        $dir = base_path('Modules/Crm/Intelligence');
        $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($dir));
        foreach ($it as $file) {
            if (! $file->isFile() || $file->getExtension() !== 'php') {
                continue;
            }
            $source = (string) file_get_contents($file->getPathname());
            foreach (['use Modules\\Commerce', 'use Modules\\Finance', 'use Modules\\Inventory', 'use Modules\\Shipping', 'use Modules\\Logistics', 'use Modules\\POS', 'use Modules\\Marketing', 'use Modules\\Manufacturing'] as $needle) {
                $this->assertStringNotContainsString($needle, $source, basename($file->getPathname())." must integrate by reference only ({$needle}).");
            }
        }
    }

    private function profileFor(Customer $c): \Modules\Crm\Intelligence\Domain\Models\CustomerIntelligenceProfile
    {
        return \Modules\Crm\Intelligence\Domain\Models\CustomerIntelligenceProfile::query()
            ->where('company_id', $this->companyId)->where('customer_id', $c->id)->firstOrFail();
    }
}
