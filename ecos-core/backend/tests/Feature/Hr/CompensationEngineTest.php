<?php

declare(strict_types=1);

namespace Tests\Feature\Hr;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Event;
use Modules\Hr\Attendance\Domain\Enums\AttendanceStatus;
use Modules\Hr\Attendance\Domain\Services\AttendanceRegistrationService;
use Modules\Hr\Compensation\Domain\Enums\ApprovalStatus;
use Modules\Hr\Compensation\Domain\Enums\CommissionMethod;
use Modules\Hr\Compensation\Domain\Enums\CommissionScope;
use Modules\Hr\Compensation\Domain\Enums\InstallmentStatus;
use Modules\Hr\Compensation\Domain\Enums\KpiMetric;
use Modules\Hr\Compensation\Domain\Enums\PayrollRunStatus;
use Modules\Hr\Compensation\Domain\Events\CompensationApproved;
use Modules\Hr\Compensation\Domain\Exceptions\CompensationException;
use Modules\Hr\Compensation\Domain\Models\Advance;
use Modules\Hr\Compensation\Domain\Models\KpiFact;
use Modules\Hr\Compensation\Domain\Models\PayrollPeriod;
use Modules\Hr\Compensation\Domain\Models\Payslip;
use Modules\Hr\Compensation\Domain\Services\AdvanceService;
use Modules\Hr\Compensation\Domain\Services\BonusService;
use Modules\Hr\Compensation\Domain\Services\CommissionEngine;
use Modules\Hr\Compensation\Domain\Services\CommissionRuleService;
use Modules\Hr\Compensation\Domain\Services\Compensation360Service;
use Modules\Hr\Compensation\Domain\Services\CompensationCalculator;
use Modules\Hr\Compensation\Domain\Services\DeductionService;
use Modules\Hr\Compensation\Domain\Services\KpiFactService;
use Modules\Hr\Compensation\Domain\Services\PayrollRunService;
use Modules\Hr\Compensation\Domain\Services\SalaryStructureService;
use Modules\Hr\Workforce\Domain\Models\Employee;
use Modules\Hr\Workforce\Domain\Services\EmployeeService;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * HR & Workforce OS — EPIC H3. Compensation Engine.
 *
 * Protects what a payroll engine lives or dies by: the formula is exact and
 * explainable, commission is driven by configuration rather than code, advances
 * recover on a schedule that always sums back to the whole, only APPROVED
 * adjustments touch pay, and approval hands off to Finance without HR posting
 * anything itself.
 */
class CompensationEngineTest extends TestCase
{
    use DatabaseTransactions;

    private string $companyId;

    private const NOW = '2026-05-20 10:00:00';

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

    private function paid(string $first, float $salary): Employee
    {
        $employee = $this->employee($first);
        app(SalaryStructureService::class)->assign($employee, $salary, ['effective_from' => '2026-01-01']);

        return $employee->refresh();
    }

    private function period(): PayrollPeriod
    {
        $period = app(PayrollRunService::class)->createPeriod($this->companyId, [
            'start_date' => '2026-05-01', 'end_date' => '2026-05-31',
        ]);

        return app(PayrollRunService::class)->openPeriod($period);
    }

    private function fact(Employee $employee, KpiMetric $metric, float $value, float $quantity = 1, string $ref = 'r1'): KpiFact
    {
        return app(KpiFactService::class)->record(
            app(KpiFactService::class)->eventFromPayload($this->companyId, [
                'metric_key' => $metric->value,
                'employee_id' => (string) $employee->id,
                'value' => $value,
                'quantity' => $quantity,
                'occurred_at' => '2026-05-10 12:00:00',
                'source_reference' => $ref,
                'idempotency_key' => $metric->value.':'.$employee->id.':'.$ref,
            ])
        );
    }

    // ═══ SALARY STRUCTURE ════════════════════════════════════════════════════════

    public function test_a_raise_closes_the_previous_structure_rather_than_overwriting_it(): void
    {
        $employee = $this->paid('Amir', 10000);
        app(SalaryStructureService::class)->assign($employee, 12000, ['effective_from' => '2026-04-01']);

        $salaries = app(SalaryStructureService::class);

        // A recalculation of March still sees the old salary.
        $this->assertSame(10000.0, (float) $salaries->inForceOn($employee, '2026-03-15')->basic_salary);
        $this->assertSame(12000.0, (float) $salaries->inForceOn($employee, '2026-05-15')->basic_salary);
        $this->assertCount(2, $salaries->history($employee));
    }

    // ═══ COMMISSION ENGINE ═══════════════════════════════════════════════════════

    public function test_a_sales_percentage_rule_pays_a_share_of_measured_sales(): void
    {
        $employee = $this->paid('Rep', 8000);

        app(CommissionRuleService::class)->create($this->companyId, [
            'code' => 'SALES2', 'name' => 'Sales 2%',
            'metric_key' => KpiMetric::SalesAmount->value,
            'method' => CommissionMethod::PercentageOfValue->value,
            'rate' => 2.0,
            'applies_to' => CommissionScope::All->value,
        ]);

        $this->fact($employee, KpiMetric::SalesAmount, 50000, 1, 'ord-1');
        $this->fact($employee, KpiMetric::SalesAmount, 30000, 1, 'ord-2');

        $earned = app(CommissionEngine::class)->calculate($employee, '2026-05-01', '2026-05-31');

        $this->assertCount(1, $earned);
        $this->assertSame(1600.0, $earned[0]['amount']);           // 2% of 80,000
        $this->assertSame(80000.0, $earned[0]['explanation']['base']);
        $this->assertSame('amount = measured value × rate%', $earned[0]['explanation']['formula']);
    }

    public function test_a_per_unit_rule_pays_by_quantity_using_the_same_engine(): void
    {
        $driver = $this->paid('Driver', 6000);

        app(CommissionRuleService::class)->create($this->companyId, [
            'code' => 'DELIV15', 'name' => 'EGP 15 per delivery',
            'metric_key' => KpiMetric::DeliveredShipments->value,
            'method' => CommissionMethod::AmountPerUnit->value,
            'rate' => 15.0,
            'applies_to' => CommissionScope::All->value,
        ]);

        // Twelve deliveries across two facts.
        $this->fact($driver, KpiMetric::DeliveredShipments, 0, 7, 'shp-1');
        $this->fact($driver, KpiMetric::DeliveredShipments, 0, 5, 'shp-2');

        $earned = app(CommissionEngine::class)->calculate($driver, '2026-05-01', '2026-05-31');

        $this->assertSame(180.0, $earned[0]['amount']);            // 12 × 15
        $this->assertSame('quantity', $earned[0]['explanation']['reads']);
    }

    public function test_a_rule_scoped_to_a_department_does_not_pay_everyone(): void
    {
        $inScope = $this->paid('InScope', 5000);
        $outOfScope = $this->paid('OutOfScope', 5000);

        $department = \Modules\Hr\Workforce\Domain\Models\Department::create([
            'company_id' => $this->companyId, 'code' => 'SLS', 'name' => 'Sales',
        ]);
        $inScope->update(['department_id' => $department->id]);

        app(CommissionRuleService::class)->create($this->companyId, [
            'code' => 'DEPT1', 'name' => 'Sales department only',
            'metric_key' => KpiMetric::SalesAmount->value,
            'method' => CommissionMethod::PercentageOfValue->value,
            'rate' => 5.0,
            'applies_to' => CommissionScope::Department->value,
            'target_id' => (string) $department->id,
        ]);

        $this->fact($inScope, KpiMetric::SalesAmount, 10000, 1, 'a');
        $this->fact($outOfScope, KpiMetric::SalesAmount, 10000, 1, 'b');

        $this->assertSame(500.0, app(CommissionEngine::class)->total($inScope->refresh(), '2026-05-01', '2026-05-31'));
        $this->assertSame(0.0, app(CommissionEngine::class)->total($outOfScope->refresh(), '2026-05-01', '2026-05-31'));
    }

    public function test_a_threshold_stops_a_rule_paying_below_it_and_a_cap_limits_it(): void
    {
        $employee = $this->paid('Capped', 5000);

        app(CommissionRuleService::class)->create($this->companyId, [
            'code' => 'CAP', 'name' => 'Capped scheme',
            'metric_key' => KpiMetric::SalesAmount->value,
            'method' => CommissionMethod::PercentageOfValue->value,
            'rate' => 10.0,
            'applies_to' => CommissionScope::All->value,
            'threshold_value' => 20000,
            'max_amount' => 1000,
        ]);

        // Under the threshold — nothing is earned.
        $this->fact($employee, KpiMetric::SalesAmount, 5000, 1, 'small');
        $this->assertSame(0.0, app(CommissionEngine::class)->total($employee, '2026-05-01', '2026-05-31'));

        // Over it, but the cap applies (10% of 55,000 = 5,500 → 1,000).
        $this->fact($employee, KpiMetric::SalesAmount, 50000, 1, 'big');
        $this->assertSame(1000.0, app(CommissionEngine::class)->total($employee, '2026-05-01', '2026-05-31'));
    }

    public function test_a_tiered_rule_selects_the_matching_band(): void
    {
        $employee = $this->paid('Tiered', 5000);

        app(CommissionRuleService::class)->create($this->companyId, [
            'code' => 'TIER', 'name' => 'Tiered scheme',
            'metric_key' => KpiMetric::SalesAmount->value,
            'method' => CommissionMethod::Tiered->value,
            'applies_to' => CommissionScope::All->value,
            'tiers' => [
                ['from_value' => 0, 'to_value' => 10000, 'rate' => 1.0],
                ['from_value' => 10000.01, 'to_value' => null, 'rate' => 4.0],
            ],
        ]);

        $this->fact($employee, KpiMetric::SalesAmount, 25000, 1, 'sale');

        $earned = app(CommissionEngine::class)->calculate($employee, '2026-05-01', '2026-05-31');
        $this->assertSame(1000.0, $earned[0]['amount']);           // 4% of 25,000
    }

    public function test_a_rule_cannot_reference_a_metric_nobody_measures(): void
    {
        $this->expectException(CompensationException::class);

        app(CommissionRuleService::class)->create($this->companyId, [
            'code' => 'BAD', 'name' => 'Nonsense', 'metric_key' => 'made.up_metric',
            'method' => CommissionMethod::PercentageOfValue->value, 'rate' => 1,
        ]);
    }

    // ═══ ADVANCES ════════════════════════════════════════════════════════════════

    public function test_an_installment_advance_schedules_parts_that_sum_to_the_whole(): void
    {
        $employee = $this->paid('Borrower', 9000);

        $advance = app(AdvanceService::class)->request($employee, [
            'type' => 'installment', 'amount' => 1000, 'installments_count' => 3,
            'first_recovery_date' => '2026-05-01',
        ]);
        $advance = app(AdvanceService::class)->approve($advance);

        $installments = $advance->installments()->get();

        $this->assertCount(3, $installments);
        // 333.33 + 333.33 + 333.34 — the last absorbs the rounding.
        $this->assertSame(1000.0, round((float) $installments->sum('amount'), 2));
        $this->assertSame(1000.0, $advance->remainingBalance());
    }

    public function test_recovering_installments_reduces_the_balance_and_settles_the_advance(): void
    {
        $employee = $this->paid('Borrower', 9000);

        $advance = app(AdvanceService::class)->approve(
            app(AdvanceService::class)->request($employee, [
                'type' => 'installment', 'amount' => 600, 'installments_count' => 2,
                'first_recovery_date' => '2026-05-01',
            ])
        );

        $first = $advance->installments()->first();
        app(AdvanceService::class)->markRecovered($first, 'payslip-1');

        $this->assertSame(300.0, $advance->refresh()->remainingBalance());
        $this->assertSame('active', $advance->refresh()->status->value);

        app(AdvanceService::class)->markRecovered($advance->installments()->skip(1)->first(), 'payslip-2');

        $this->assertSame(0.0, $advance->refresh()->remainingBalance());
        $this->assertSame('settled', $advance->refresh()->status->value);
    }

    public function test_an_installment_advance_must_state_how_many_installments(): void
    {
        $this->expectException(CompensationException::class);

        app(AdvanceService::class)->request($this->paid('X', 5000), [
            'type' => 'installment', 'amount' => 1000, 'installments_count' => 1,
        ]);
    }

    // ═══ THE FORMULA ═════════════════════════════════════════════════════════════

    public function test_the_net_is_basic_plus_bonus_plus_commission_less_advances_and_deductions(): void
    {
        $employee = $this->paid('Amir', 10000);
        $period = $this->period();

        // Commission: 2% of 100,000 = 2,000.
        app(CommissionRuleService::class)->create($this->companyId, [
            'code' => 'S2', 'name' => 'Sales 2%', 'metric_key' => KpiMetric::SalesAmount->value,
            'method' => CommissionMethod::PercentageOfValue->value, 'rate' => 2.0,
            'applies_to' => CommissionScope::All->value,
        ]);
        $this->fact($employee, KpiMetric::SalesAmount, 100000, 1, 'sale');

        // Bonus 1,500 — approved.
        app(BonusService::class)->approve(app(BonusService::class)->award($employee, [
            'amount' => 1500, 'reason' => 'Great month', 'awarded_on' => '2026-05-15',
        ]));

        // Deduction 500 — approved.
        app(DeductionService::class)->approve(app(DeductionService::class)->raise($employee, [
            'type' => 'administrative_penalty', 'amount' => 500,
            'reason' => 'Policy breach', 'deduction_date' => '2026-05-10',
        ]));

        // Advance: 800 over 2 installments, first due inside the period.
        app(AdvanceService::class)->approve(app(AdvanceService::class)->request($employee, [
            'type' => 'installment', 'amount' => 800, 'installments_count' => 2,
            'first_recovery_date' => '2026-05-05',
        ]));

        $result = app(CompensationCalculator::class)->calculate($employee->refresh(), $period);

        $this->assertSame(10000.0, $result['basic_salary']);
        $this->assertSame(1500.0, $result['bonus_total']);
        $this->assertSame(2000.0, $result['commission_total']);
        $this->assertSame(400.0, $result['advance_total']);
        $this->assertSame(500.0, $result['deduction_total']);
        $this->assertSame(13500.0, $result['gross_salary']);       // 10000 + 1500 + 2000
        $this->assertSame(12600.0, $result['net_salary']);         // 13500 − 400 − 500

        $this->assertSame(
            'net = basic + bonus + commission − advances − approved deductions',
            $result['explanation']['formula']
        );
    }

    public function test_unapproved_adjustments_never_reach_pay(): void
    {
        $employee = $this->paid('Amir', 10000);
        $period = $this->period();

        // Raised but not approved — neither should count.
        app(BonusService::class)->award($employee, ['amount' => 5000, 'reason' => 'Pending', 'awarded_on' => '2026-05-10']);
        app(DeductionService::class)->raise($employee, [
            'type' => 'manual', 'amount' => 900, 'reason' => 'Pending', 'deduction_date' => '2026-05-10',
        ]);

        $result = app(CompensationCalculator::class)->calculate($employee, $period);

        $this->assertSame(0.0, $result['bonus_total']);
        $this->assertSame(0.0, $result['deduction_total']);
        $this->assertSame(10000.0, $result['net_salary']);
    }

    public function test_the_calculation_is_deterministic(): void
    {
        $employee = $this->paid('Amir', 10000);
        $period = $this->period();

        app(BonusService::class)->approve(app(BonusService::class)->award($employee, [
            'amount' => 750, 'reason' => 'Bonus', 'awarded_on' => '2026-05-12',
        ]));

        $calculator = app(CompensationCalculator::class);
        $first = $calculator->calculate($employee, $period);
        $second = $calculator->calculate($employee, $period);

        $this->assertSame($first['net_salary'], $second['net_salary']);
        $this->assertSame($first['gross_salary'], $second['gross_salary']);
        $this->assertSame($first['lines'], $second['lines']);
    }

    // ═══ ATTENDANCE INTEGRATION ══════════════════════════════════════════════════

    public function test_attendance_is_reported_as_a_suggestion_and_never_deducted_automatically(): void
    {
        $employee = $this->paid('Absent', 3000);
        $period = $this->period();

        foreach (['2026-05-04', '2026-05-05'] as $date) {
            app(AttendanceRegistrationService::class)->register($employee, $date, AttendanceStatus::Absent);
        }

        $result = app(CompensationCalculator::class)->calculate($employee, $period);

        // Nothing was deducted — no decision has been made.
        $this->assertSame(0.0, $result['deduction_total']);
        $this->assertSame(3000.0, $result['net_salary']);

        $attendance = $result['explanation']['components']['deductions']['attendance'];
        $this->assertSame(2, $attendance['unauthorized_absence_days']);
        $this->assertSame(100.0, $attendance['daily_rate']);        // 3000 ÷ 30
        $this->assertSame(200.0, $attendance['indicative_absence_value']);

        // The workspace offers it; a human still has to raise and approve it.
        $suggestions = app(CompensationCalculator::class)->suggestedAttendanceDeductions($employee, $period);
        $this->assertSame('unauthorized_absence', $suggestions[0]['type']);
        $this->assertSame(200.0, $suggestions[0]['amount']);
    }

    // ═══ PAYROLL RUN & APPROVAL ══════════════════════════════════════════════════

    public function test_recalculating_replaces_the_previous_run(): void
    {
        $this->paid('Amir', 10000);
        $period = $this->period();
        $payroll = app(PayrollRunService::class);

        $first = $payroll->calculate($period);
        $second = $payroll->calculate($period->refresh());

        $this->assertNotSame((string) $first->id, (string) $second->id);
        $this->assertSame(1, $period->refresh()->runs()->count());
    }

    public function test_approving_freezes_payslips_recovers_installments_and_tells_finance(): void
    {
        Event::fake([CompensationApproved::class]);

        $employee = $this->paid('Amir', 10000);
        $period = $this->period();

        app(AdvanceService::class)->approve(app(AdvanceService::class)->request($employee, [
            'type' => 'one_time', 'amount' => 500, 'first_recovery_date' => '2026-05-05',
        ]));

        $payroll = app(PayrollRunService::class);
        $run = $payroll->calculate($period);
        $approved = $payroll->approve($run, 7);

        $this->assertSame(PayrollRunStatus::Approved, $approved->status);
        $this->assertSame('approved', Payslip::where('payroll_run_id', $run->id)->first()->status);
        $this->assertSame(9500.0, (float) $approved->total_net);

        // The installment the payslip took is now recovered and the advance settled.
        $advance = Advance::where('employee_id', $employee->id)->first();
        $this->assertSame(InstallmentStatus::Recovered, $advance->installments()->first()->status);
        $this->assertSame(0.0, $advance->refresh()->remainingBalance());

        Event::assertDispatched(CompensationApproved::class, function (CompensationApproved $event) use ($run) {
            return $event->payrollRunId === (string) $run->id
                && $event->eventName() === 'hr.compensation.approved'
                && $event->totalNet === 9500.0
                && count($event->employees) === 1;
        });
    }

    public function test_an_approved_run_cannot_be_approved_again(): void
    {
        $this->paid('Amir', 10000);
        $period = $this->period();
        $payroll = app(PayrollRunService::class);

        $run = $payroll->approve($payroll->calculate($period), 1);

        $this->expectException(CompensationException::class);
        $payroll->approve($run->refresh(), 1);
    }

    public function test_an_approved_period_cannot_be_recalculated(): void
    {
        $this->paid('Amir', 10000);
        $period = $this->period();
        $payroll = app(PayrollRunService::class);
        $payroll->approve($payroll->calculate($period), 1);

        $this->expectException(CompensationException::class);
        $payroll->calculate($period->refresh());
    }

    public function test_the_payslip_keeps_itemised_lines_that_add_back_up(): void
    {
        $employee = $this->paid('Amir', 10000);
        $period = $this->period();

        app(BonusService::class)->approve(app(BonusService::class)->award($employee, [
            'amount' => 1000, 'reason' => 'Bonus', 'awarded_on' => '2026-05-10',
        ]));
        app(DeductionService::class)->approve(app(DeductionService::class)->raise($employee, [
            'type' => 'manual', 'amount' => 250, 'reason' => 'Deduction', 'deduction_date' => '2026-05-10',
        ]));

        $run = app(PayrollRunService::class)->calculate($period);
        $payslip = Payslip::with('lines')->where('payroll_run_id', $run->id)->first();

        $this->assertSame(10750.0, (float) $payslip->net_salary);
        $this->assertSame($payslip->recomputedNet(), (float) $payslip->net_salary);

        // The signed lines reconstruct the net exactly.
        $fromLines = round(array_sum($payslip->lines->map(fn ($l) => $l->signedAmount())->all()), 2);
        $this->assertSame(10750.0, $fromLines);
    }

    // ═══ KPI FACTS ═══════════════════════════════════════════════════════════════

    public function test_kpi_facts_are_idempotent_and_append_only(): void
    {
        $employee = $this->employee('Amir');

        $this->fact($employee, KpiMetric::SalesAmount, 1000, 1, 'same-ref');
        $this->fact($employee, KpiMetric::SalesAmount, 1000, 1, 'same-ref');

        $this->assertSame(1, KpiFact::where('employee_id', $employee->id)->count());

        $fact = KpiFact::where('employee_id', $employee->id)->first();
        $fact->value = 99999;
        $this->assertFalse($fact->save());
        $this->assertFalse($fact->delete());
    }

    // ═══ COMPENSATION 360 ════════════════════════════════════════════════════════

    public function test_compensation_360_assembles_salary_commission_advances_and_history(): void
    {
        $employee = $this->paid('Amir', 10000);

        app(CommissionRuleService::class)->create($this->companyId, [
            'code' => 'S1', 'name' => 'Sales 1%', 'metric_key' => KpiMetric::SalesAmount->value,
            'method' => CommissionMethod::PercentageOfValue->value, 'rate' => 1.0,
            'applies_to' => CommissionScope::All->value,
        ]);
        $this->fact($employee, KpiMetric::SalesAmount, 20000, 1, 'sale');

        app(AdvanceService::class)->approve(app(AdvanceService::class)->request($employee, [
            'type' => 'installment', 'amount' => 900, 'installments_count' => 3,
            'first_recovery_date' => '2026-06-01',
        ]));

        $view = app(Compensation360Service::class)->build($employee->refresh());

        $this->assertSame(10000.0, $view['salary']['basic_salary']);
        $this->assertCount(1, $view['commission']['rules']);
        $this->assertSame(200.0, $view['commission']['month_to_date'][0]['amount']);
        $this->assertSame(900.0, $view['advances']['remaining_balance']);
        $this->assertCount(3, $view['advances']['open'][0]['schedule']);
    }

    public function test_only_approved_deductions_count_toward_pending_approvals(): void
    {
        $employee = $this->paid('Amir', 10000);

        app(DeductionService::class)->raise($employee, [
            'type' => 'manual', 'amount' => 100, 'reason' => 'Pending', 'deduction_date' => '2026-05-10',
        ]);

        $view = app(Compensation360Service::class)->build($employee);

        $this->assertSame(1, $view['pending_approvals']['deductions']);
        $this->assertSame(ApprovalStatus::Pending->value, $view['deductions'][0]['status']);
    }

    // ═══ SECURITY ════════════════════════════════════════════════════════════════

    public function test_compensation_routes_require_authentication(): void
    {
        $this->getJson('/api/hr/compensation/periods')->assertUnauthorized();
        $this->getJson('/api/hr/commission/rules')->assertUnauthorized();
        $this->postJson('/api/hr/kpi/facts', [])->assertUnauthorized();
    }
}
