<?php

declare(strict_types=1);

namespace Tests\Feature\Hr;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Carbon;
use Modules\Hr\Compensation\Domain\Enums\ApprovalStatus;
use Modules\Hr\Compensation\Domain\Enums\KpiMetric;
use Modules\Hr\Compensation\Domain\Exceptions\CompensationException;
use Modules\Hr\Compensation\Domain\Models\Bonus;
use Modules\Hr\Compensation\Domain\Models\Deduction;
use Modules\Hr\Compensation\Domain\Services\KpiFactService;
use Modules\Hr\Compensation\Domain\Services\SalaryStructureService;
use Modules\Hr\Performance\Domain\Enums\GoalSubject;
use Modules\Hr\Performance\Domain\Enums\IncidentCategory;
use Modules\Hr\Performance\Domain\Enums\PerformanceStatus;
use Modules\Hr\Performance\Domain\Enums\RecommendationStatus;
use Modules\Hr\Performance\Domain\Services\BonusRecommendationService;
use Modules\Hr\Performance\Domain\Services\GoalService;
use Modules\Hr\Performance\Domain\Services\IncidentService;
use Modules\Hr\Performance\Domain\Services\KpiEngine;
use Modules\Hr\Performance\Domain\Services\ManagerReviewService;
use Modules\Hr\Performance\Domain\Services\PerformanceDashboardService;
use Modules\Hr\Performance\Domain\Services\PerformanceEvaluationService;
use Modules\Hr\Workforce\Domain\Models\Department;
use Modules\Hr\Workforce\Domain\Models\Employee;
use Modules\Hr\Workforce\Domain\Services\EmployeeService;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * HR & Workforce OS — EPIC H4. Performance & Incentives.
 *
 * Protects the guarantees a KPI-driven performance system needs: actuals are
 * collected rather than typed in, achievement is arithmetic anyone can check,
 * dashboards and recommendations read the same snapshots, and a recommendation is
 * only ever a suggestion until a manager decides.
 */
class PerformanceEngineTest extends TestCase
{
    use DatabaseTransactions;

    private string $companyId;

    private const NOW = '2026-05-20 10:00:00';

    private const MONTH = '2026-05';

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse(self::NOW));
        $this->companyId = (string) Company::factory()->create()->id;
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function employee(string $first = 'Amir', array $data = []): Employee
    {
        return app(EmployeeService::class)->create($this->companyId, array_merge([
            'first_name' => $first, 'last_name' => 'Hassan',
        ], $data));
    }

    private function fact(Employee $employee, KpiMetric $metric, float $value, float $quantity, string $ref): void
    {
        app(KpiFactService::class)->record(
            app(KpiFactService::class)->eventFromPayload($this->companyId, [
                'metric_key' => $metric->value,
                'employee_id' => (string) $employee->id,
                'department_id' => $employee->department_id === null ? null : (string) $employee->department_id,
                'value' => $value,
                'quantity' => $quantity,
                'occurred_at' => '2026-05-10 12:00:00',
                'idempotency_key' => $metric->value.':'.$employee->id.':'.$ref,
            ])
        );
    }

    private function goal(Employee $employee, KpiMetric $metric, float $target, array $extra = []): void
    {
        app(GoalService::class)->set($this->companyId, array_merge([
            'subject_type' => GoalSubject::Employee->value,
            'subject_id' => (string) $employee->id,
            'metric_key' => $metric->value,
            'target_value' => $target,
            'period_month' => self::MONTH,
        ], $extra));
    }

    // ═══ KPI COLLECTION ══════════════════════════════════════════════════════════

    public function test_a_count_metric_is_measured_by_quantity_and_a_money_metric_by_value(): void
    {
        $employee = $this->employee();

        $this->fact($employee, KpiMetric::OrdersPacked, 0, 40, 'p1');
        $this->fact($employee, KpiMetric::OrdersPacked, 0, 35, 'p2');
        $this->fact($employee, KpiMetric::SalesAmount, 12000, 1, 's1');

        $engine = app(KpiEngine::class);

        $this->assertSame(75.0, $engine->actual($this->companyId, GoalSubject::Employee, (string) $employee->id, KpiMetric::OrdersPacked->value, self::MONTH)['value']);
        $this->assertSame(12000.0, $engine->actual($this->companyId, GoalSubject::Employee, (string) $employee->id, KpiMetric::SalesAmount->value, self::MONTH)['value']);
    }

    public function test_a_percentage_metric_is_averaged_rather_than_summed(): void
    {
        $employee = $this->employee();

        $this->fact($employee, KpiMetric::InventoryAccuracy, 98, 1, 'c1');
        $this->fact($employee, KpiMetric::InventoryAccuracy, 96, 1, 'c2');

        $actual = app(KpiEngine::class)->actual(
            $this->companyId, GoalSubject::Employee, (string) $employee->id, KpiMetric::InventoryAccuracy->value, self::MONTH
        );

        $this->assertSame(97.0, $actual['value']);
        $this->assertSame('average', $actual['aggregation']);
    }

    public function test_measured_metrics_are_listed_even_without_a_goal(): void
    {
        $employee = $this->employee();
        $this->fact($employee, KpiMetric::TicketsClosed, 0, 22, 't1');

        $metrics = app(KpiEngine::class)->measuredMetrics(
            $this->companyId, GoalSubject::Employee, (string) $employee->id, self::MONTH
        );

        $this->assertCount(1, $metrics);
        $this->assertSame('Tickets Closed', $metrics[0]['label']);
        $this->assertSame(22.0, $metrics[0]['actual']);
    }

    // ═══ GOALS & ACHIEVEMENT ═════════════════════════════════════════════════════

    public function test_achievement_is_actual_over_target(): void
    {
        $employee = $this->employee();
        $this->goal($employee, KpiMetric::DeliveredShipments, 100);
        $this->fact($employee, KpiMetric::DeliveredShipments, 0, 120, 'd1');

        $snapshots = app(PerformanceEvaluationService::class)->evaluateSubject(
            $this->companyId, GoalSubject::Employee, (string) $employee->id, self::MONTH
        );

        $this->assertSame(120.0, (float) $snapshots[0]->achievement_percent);
        $this->assertSame(PerformanceStatus::Exceeded, $snapshots[0]->status);
        $this->assertSame(120.0, (float) $snapshots[0]->actual_value);
    }

    public function test_a_lower_is_better_goal_inverts_the_ratio(): void
    {
        $employee = $this->employee();
        // Keep shortages under 1,000 — a metric where less is better.
        $this->goal($employee, KpiMetric::InventoryShortage, 1000);
        $this->fact($employee, KpiMetric::InventoryShortage, 500, 1, 'sh1');

        $snapshot = app(PerformanceEvaluationService::class)->evaluateSubject(
            $this->companyId, GoalSubject::Employee, (string) $employee->id, self::MONTH
        )[0];

        // Half the allowed shortage is 200% achievement.
        $this->assertSame('lte', $snapshot->goal->comparison);
        $this->assertSame(200.0, (float) $snapshot->achievement_percent);
    }

    public function test_a_goal_cannot_target_a_metric_nobody_measures(): void
    {
        $this->expectException(CompensationException::class);

        app(GoalService::class)->set($this->companyId, [
            'subject_type' => 'employee', 'subject_id' => (string) $this->employee()->id,
            'metric_key' => 'invented.metric', 'target_value' => 10, 'period_month' => self::MONTH,
        ]);
    }

    public function test_recomputing_a_month_replaces_its_snapshot(): void
    {
        $employee = $this->employee();
        $this->goal($employee, KpiMetric::OrdersPrepared, 50);
        $this->fact($employee, KpiMetric::OrdersPrepared, 0, 25, 'a');

        $evaluation = app(PerformanceEvaluationService::class);
        $evaluation->evaluatePeriod($this->companyId, self::MONTH);

        $this->fact($employee, KpiMetric::OrdersPrepared, 0, 25, 'b');
        $evaluation->evaluatePeriod($this->companyId, self::MONTH);

        $snapshots = \Modules\Hr\Performance\Domain\Models\PerformanceSnapshot::where('subject_id', $employee->id)->get();

        $this->assertCount(1, $snapshots);
        $this->assertSame(50.0, (float) $snapshots[0]->actual_value);
        $this->assertSame(100.0, (float) $snapshots[0]->achievement_percent);
    }

    public function test_overall_achievement_is_weighted_across_goals(): void
    {
        $employee = $this->employee();

        // 200% on a weight-1 goal, 50% on a weight-3 goal → (200 + 150)/4 = 87.5
        $this->goal($employee, KpiMetric::OrdersPacked, 10, ['weight' => 1]);
        $this->goal($employee, KpiMetric::OrdersPrepared, 100, ['weight' => 3]);
        $this->fact($employee, KpiMetric::OrdersPacked, 0, 25, 'k1');
        $this->fact($employee, KpiMetric::OrdersPrepared, 0, 50, 'k2');

        app(PerformanceEvaluationService::class)->evaluatePeriod($this->companyId, self::MONTH);

        $overall = app(PerformanceEvaluationService::class)->overallAchievement(
            $this->companyId, GoalSubject::Employee, (string) $employee->id, self::MONTH
        );

        $this->assertSame(2, $overall['goals']);
        $this->assertSame(87.5, $overall['achievement_percent']);
        $this->assertTrue($overall['weighted']);
    }

    // ═══ DASHBOARDS ══════════════════════════════════════════════════════════════

    public function test_the_employee_dashboard_shows_target_actual_achievement_and_status(): void
    {
        $employee = $this->employee();
        $this->goal($employee, KpiMetric::DeliveredShipments, 200);
        $this->fact($employee, KpiMetric::DeliveredShipments, 0, 150, 'd');

        app(PerformanceEvaluationService::class)->evaluatePeriod($this->companyId, self::MONTH);

        $dashboard = app(PerformanceDashboardService::class)->forEmployee($employee, self::MONTH);
        $goal = $dashboard['goals'][0];

        $this->assertSame(200.0, $goal['target']);
        $this->assertSame(150.0, $goal['actual']);
        $this->assertSame(75.0, $goal['achievement_percent']);
        $this->assertSame(PerformanceStatus::AtRisk->value, $goal['status']);
    }

    public function test_the_department_dashboard_ranks_the_team(): void
    {
        $department = Department::create([
            'company_id' => $this->companyId, 'code' => 'OPS', 'name' => 'Operations',
        ]);

        $strong = $this->employee('Strong', ['department_id' => $department->id]);
        $weak = $this->employee('Weak', ['department_id' => $department->id]);

        $this->goal($strong, KpiMetric::OrdersPacked, 100);
        $this->goal($weak, KpiMetric::OrdersPacked, 100);
        $this->fact($strong, KpiMetric::OrdersPacked, 0, 150, 's');
        $this->fact($weak, KpiMetric::OrdersPacked, 0, 40, 'w');

        app(PerformanceEvaluationService::class)->evaluatePeriod($this->companyId, self::MONTH);

        $dashboard = app(PerformanceDashboardService::class)->forDepartment(
            $this->companyId, (string) $department->id, self::MONTH
        );

        $this->assertSame(2, $dashboard['team']['headcount']);
        $this->assertSame(95.0, $dashboard['team']['average_achievement_percent']);   // (150 + 40)/2
        $this->assertSame(1, $dashboard['team']['meeting_target']);
        $this->assertSame(1, $dashboard['team']['needing_attention']);

        $this->assertSame('Strong Hassan', $dashboard['rankings'][0]['name']);
        $this->assertSame(1, $dashboard['rankings'][0]['rank']);
        $this->assertSame('Weak Hassan', $dashboard['rankings'][1]['name']);
    }

    public function test_performance_history_is_a_month_by_month_series(): void
    {
        $employee = $this->employee();

        foreach (['2026-03', '2026-04', self::MONTH] as $month) {
            app(GoalService::class)->set($this->companyId, [
                'subject_type' => 'employee', 'subject_id' => (string) $employee->id,
                'metric_key' => KpiMetric::OrdersPacked->value, 'target_value' => 100, 'period_month' => $month,
            ]);
        }

        $this->fact($employee, KpiMetric::OrdersPacked, 0, 90, 'may');
        foreach (['2026-03', '2026-04', self::MONTH] as $month) {
            app(PerformanceEvaluationService::class)->evaluatePeriod($this->companyId, $month);
        }

        $history = app(PerformanceDashboardService::class)->history(
            $this->companyId, GoalSubject::Employee, (string) $employee->id, 6
        );

        $this->assertCount(3, $history);
        $this->assertSame('2026-03', $history[0]['period_month']);
        $this->assertSame(90.0, $history[2]['achievement_percent']);   // only May had facts
    }

    // ═══ MANAGER REVIEW ══════════════════════════════════════════════════════════

    public function test_a_manager_review_holds_a_rating_and_three_notes(): void
    {
        $employee = $this->employee();
        $manager = $this->employee('Manager');

        $review = app(ManagerReviewService::class)->save($employee, self::MONTH, [
            'overall_rating' => 4,
            'strengths' => 'Reliable and fast',
            'improvement_notes' => 'Could document handovers',
            'manager_comments' => 'Solid month',
        ], $manager);

        $review = app(ManagerReviewService::class)->submit($review);

        $this->assertSame(4, $review->overall_rating);
        $this->assertTrue($review->isSubmitted());
        $this->assertSame((string) $manager->id, (string) $review->reviewer_employee_id);

        // One review per employee per month — saving again updates it.
        app(ManagerReviewService::class)->save($employee, self::MONTH, ['overall_rating' => 5]);
        $this->assertSame(1, \Modules\Hr\Performance\Domain\Models\ManagerReview::where('employee_id', $employee->id)->count());
    }

    // ═══ BONUS RECOMMENDATIONS ═══════════════════════════════════════════════════

    public function test_a_recommendation_is_banded_on_achievement_and_explains_itself(): void
    {
        $employee = $this->employee();
        app(SalaryStructureService::class)->assign($employee, 10000, ['effective_from' => '2026-01-01']);

        $this->goal($employee, KpiMetric::OrdersPacked, 100);
        $this->fact($employee, KpiMetric::OrdersPacked, 0, 125, 'p');
        app(PerformanceEvaluationService::class)->evaluatePeriod($this->companyId, self::MONTH);

        $recommendation = app(BonusRecommendationService::class)->recommendFor($employee->refresh(), self::MONTH);

        $this->assertNotNull($recommendation);
        $this->assertSame(125.0, (float) $recommendation->achievement_percent);
        $this->assertSame('outstanding', $recommendation->rule_key);
        $this->assertSame(2000.0, (float) $recommendation->recommended_amount);   // 20% of 10,000
        $this->assertSame('recommended = basic salary × band percent', $recommendation->explanation['formula']);
    }

    public function test_no_recommendation_is_produced_below_the_lowest_band(): void
    {
        $employee = $this->employee();
        app(SalaryStructureService::class)->assign($employee, 10000, ['effective_from' => '2026-01-01']);

        $this->goal($employee, KpiMetric::OrdersPacked, 100);
        $this->fact($employee, KpiMetric::OrdersPacked, 0, 40, 'p');
        app(PerformanceEvaluationService::class)->evaluatePeriod($this->companyId, self::MONTH);

        $this->assertNull(app(BonusRecommendationService::class)->recommendFor($employee->refresh(), self::MONTH));
    }

    public function test_approving_a_recommendation_creates_a_pending_bonus(): void
    {
        $employee = $this->employee();
        app(SalaryStructureService::class)->assign($employee, 10000, ['effective_from' => '2026-01-01']);
        $this->goal($employee, KpiMetric::OrdersPacked, 100);
        $this->fact($employee, KpiMetric::OrdersPacked, 0, 110, 'p');
        app(PerformanceEvaluationService::class)->evaluatePeriod($this->companyId, self::MONTH);

        $recommendation = app(BonusRecommendationService::class)->recommendFor($employee->refresh(), self::MONTH);
        $decided = app(BonusRecommendationService::class)->approve($recommendation);

        $this->assertSame(RecommendationStatus::Approved, $decided->status);
        $this->assertNotNull($decided->bonus_id);

        $bonus = Bonus::find($decided->bonus_id);
        $this->assertSame(1250.0, (float) $bonus->amount);            // 12.5% of 10,000
        $this->assertSame('performance_recommendation', $bonus->source);
        // Still needs approving on its own before it reaches a payslip.
        $this->assertSame(ApprovalStatus::Pending, $bonus->status);
    }

    public function test_a_manager_can_modify_the_amount_and_the_override_is_visible(): void
    {
        $employee = $this->employee();
        app(SalaryStructureService::class)->assign($employee, 10000, ['effective_from' => '2026-01-01']);
        $this->goal($employee, KpiMetric::OrdersPacked, 100);
        $this->fact($employee, KpiMetric::OrdersPacked, 0, 130, 'p');
        app(PerformanceEvaluationService::class)->evaluatePeriod($this->companyId, self::MONTH);

        $recommendation = app(BonusRecommendationService::class)->recommendFor($employee->refresh(), self::MONTH);
        $decided = app(BonusRecommendationService::class)->modify($recommendation, 500.0, null, 'Budget constrained');

        $this->assertSame(RecommendationStatus::Modified, $decided->status);
        $this->assertSame(2000.0, (float) $decided->recommended_amount);
        $this->assertSame(500.0, (float) $decided->decided_amount);
        $this->assertTrue($decided->wasOverridden());
        $this->assertSame(500.0, (float) Bonus::find($decided->bonus_id)->amount);
    }

    public function test_rejecting_a_recommendation_creates_no_bonus(): void
    {
        $employee = $this->employee();
        app(SalaryStructureService::class)->assign($employee, 10000, ['effective_from' => '2026-01-01']);
        $this->goal($employee, KpiMetric::OrdersPacked, 100);
        $this->fact($employee, KpiMetric::OrdersPacked, 0, 115, 'p');
        app(PerformanceEvaluationService::class)->evaluatePeriod($this->companyId, self::MONTH);

        $recommendation = app(BonusRecommendationService::class)->recommendFor($employee->refresh(), self::MONTH);
        $decided = app(BonusRecommendationService::class)->reject($recommendation, null, 'Not this month');

        $this->assertSame(RecommendationStatus::Rejected, $decided->status);
        $this->assertNull($decided->bonus_id);
        $this->assertSame(0, Bonus::where('employee_id', $employee->id)->count());
    }

    // ═══ INCIDENTS ═══════════════════════════════════════════════════════════════

    public function test_an_incident_records_the_module_and_document_by_reference(): void
    {
        $employee = $this->employee();

        $incident = app(IncidentService::class)->record($employee, [
            'category' => IncidentCategory::InventoryShortage->value,
            'description' => 'Stock count short by 12 units',
            'related_module' => 'inventory',
            'related_reference' => 'count-8891',
            'related_document_type' => 'stock_count',
            'amount' => 600,
        ]);

        $this->assertSame(IncidentCategory::InventoryShortage, $incident->category);
        $this->assertSame('inventory', $incident->related_module);
        $this->assertSame('count-8891', $incident->related_reference);
        $this->assertFalse($incident->hasFinancialOutcome());
    }

    public function test_raising_a_deduction_from_an_incident_leaves_it_pending_approval(): void
    {
        $employee = $this->employee();

        $incident = app(IncidentService::class)->record($employee, [
            'category' => IncidentCategory::InventoryDamage->value,
            'description' => 'Damaged pallet',
            'related_module' => 'inventory',
            'related_reference' => 'dmg-42',
            'amount' => 750,
        ]);

        $incident = app(IncidentService::class)->raiseDeduction($incident, []);

        $this->assertNotNull($incident->deduction_id);
        $this->assertTrue($incident->hasFinancialOutcome());

        $deduction = Deduction::find($incident->deduction_id);
        $this->assertSame(750.0, (float) $deduction->amount);
        $this->assertSame('inventory_damage', $deduction->type->value);
        $this->assertSame('dmg-42', $deduction->source_reference);
        // Recording is not deciding.
        $this->assertSame(ApprovalStatus::Pending, $deduction->status);
    }

    public function test_a_positive_incident_never_raises_a_deduction(): void
    {
        $employee = $this->employee();

        $incident = app(IncidentService::class)->record($employee, [
            'category' => IncidentCategory::CustomerAppreciation->value,
            'description' => 'Customer praised the delivery',
        ]);

        $incident = app(IncidentService::class)->raiseDeduction($incident, ['amount' => 100]);

        $this->assertNull($incident->deduction_id);
    }

    public function test_the_incident_summary_groups_by_category(): void
    {
        $employee = $this->employee();
        $incidents = app(IncidentService::class);

        $incidents->record($employee, ['category' => 'reward', 'description' => 'Great work']);
        $incidents->record($employee, ['category' => 'warning', 'description' => 'Late twice']);
        $incidents->record($employee, ['category' => 'reward', 'description' => 'Again']);

        $summary = $incidents->summaryFor($employee);

        $this->assertSame(3, $summary['total']);
        $this->assertSame(2, $summary['positive']);
        $this->assertSame(2, $summary['by_category']['reward']);
    }

    // ═══ SECURITY ════════════════════════════════════════════════════════════════

    public function test_performance_routes_require_authentication(): void
    {
        $this->getJson('/api/hr/performance/goals')->assertUnauthorized();
        $this->getJson('/api/hr/performance/recommendations')->assertUnauthorized();
        $this->getJson('/api/hr/performance/incidents')->assertUnauthorized();
    }
}
