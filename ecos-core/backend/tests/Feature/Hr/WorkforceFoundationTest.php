<?php

declare(strict_types=1);

namespace Tests\Feature\Hr;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Modules\Hr\Workforce\Domain\Enums\ContractStatus;
use Modules\Hr\Workforce\Domain\Enums\ContractType;
use Modules\Hr\Workforce\Domain\Enums\EmployeeStatus;
use Modules\Hr\Workforce\Domain\Enums\ReportingLineType;
use Modules\Hr\Workforce\Domain\Exceptions\WorkforceException;
use Modules\Hr\Workforce\Domain\Models\Employee;
use Modules\Hr\Workforce\Domain\Services\DepartmentService;
use Modules\Hr\Workforce\Domain\Services\Employee360Service;
use Modules\Hr\Workforce\Domain\Services\EmployeeDocumentService;
use Modules\Hr\Workforce\Domain\Services\EmployeeService;
use Modules\Hr\Workforce\Domain\Services\EmploymentContractService;
use Modules\Hr\Workforce\Domain\Services\OrganizationChartService;
use Modules\Hr\Workforce\Domain\Services\ReportingLineService;
use Modules\Hr\Workforce\Domain\Services\WorkforceStructureService;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * HR & Workforce OS — EPIC H1. Organization & Workforce Foundation.
 *
 * Protects the guarantees the workforce master rests on: employee numbers are
 * unique and sequential, the status and contract machines cannot be bypassed, a
 * person has at most one active contract, and neither the department tree nor the
 * reporting chain can be bent into a cycle.
 */
class WorkforceFoundationTest extends TestCase
{
    use DatabaseTransactions;

    private string $companyId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->companyId = (string) Company::factory()->create()->id;
    }

    private function employee(string $first = 'Amir', array $data = []): Employee
    {
        return app(EmployeeService::class)->create($this->companyId, array_merge([
            'first_name' => $first,
            'last_name' => 'Hassan',
        ], $data));
    }

    // ═══ EMPLOYEE MASTER ═════════════════════════════════════════════════════════

    public function test_employee_numbers_are_sequential_and_scoped_to_the_company(): void
    {
        $first = $this->employee('Amir');
        $second = $this->employee('Nour');

        $this->assertSame('EMP-0001', $first->employee_number);
        $this->assertSame('EMP-0002', $second->employee_number);

        // A second company starts its own sequence.
        $otherCompany = (string) Company::factory()->create()->id;
        $other = app(EmployeeService::class)->create($otherCompany, ['first_name' => 'Sara', 'last_name' => 'K']);
        $this->assertSame('EMP-0001', $other->employee_number);
    }

    public function test_an_employee_can_be_transferred_between_departments(): void
    {
        $sales = app(DepartmentService::class)->create($this->companyId, ['code' => 'SLS', 'name' => 'Sales']);
        $ops = app(DepartmentService::class)->create($this->companyId, ['code' => 'OPS', 'name' => 'Operations']);

        $employee = $this->employee('Amir', ['department_id' => $sales->id]);
        $moved = app(EmployeeService::class)->transfer($employee, ['department_id' => (string) $ops->id]);

        $this->assertSame((string) $ops->id, (string) $moved->department_id);
    }

    public function test_a_position_cannot_be_filled_beyond_its_headcount_limit(): void
    {
        $position = app(WorkforceStructureService::class)->createPosition($this->companyId, [
            'code' => 'DRV', 'title' => 'Driver', 'headcount_limit' => 1,
        ]);

        $this->employee('Amir', ['position_id' => $position->id]);

        $this->expectException(WorkforceException::class);
        $this->employee('Nour', ['position_id' => $position->id]);
    }

    public function test_status_transitions_follow_the_machine(): void
    {
        $employee = $this->employee();
        $service = app(EmployeeService::class);

        $onLeave = $service->changeStatus($employee, EmployeeStatus::OnLeave);
        $this->assertSame(EmployeeStatus::OnLeave, $onLeave->status);

        $terminated = $service->terminate($onLeave, 'Role eliminated');
        $this->assertSame(EmployeeStatus::Terminated, $terminated->status);
        $this->assertNotNull($terminated->termination_date);

        // Leaving is terminal — there is no way back through the machine.
        $this->expectException(WorkforceException::class);
        $service->changeStatus($terminated->fresh(), EmployeeStatus::Active);
    }

    public function test_someone_who_has_left_cannot_be_terminated_twice(): void
    {
        $employee = app(EmployeeService::class)->terminate($this->employee(), 'Resigned', null, true);

        $this->expectException(WorkforceException::class);
        app(EmployeeService::class)->terminate($employee->fresh(), 'Again');
    }

    // ═══ CONTRACTS ═══════════════════════════════════════════════════════════════

    public function test_an_employee_can_hold_only_one_active_contract(): void
    {
        $employee = $this->employee();
        $contracts = app(EmploymentContractService::class);

        $first = $contracts->issue($this->companyId, $employee, [
            'type' => ContractType::Permanent->value, 'start_date' => '2026-01-01',
        ]);
        $contracts->activate($first);

        $second = $contracts->issue($this->companyId, $employee, [
            'type' => ContractType::Permanent->value, 'start_date' => '2026-06-01',
        ]);

        $this->expectException(WorkforceException::class);
        $contracts->activate($second);
    }

    public function test_a_fixed_term_contract_requires_an_end_date(): void
    {
        $this->expectException(WorkforceException::class);

        app(EmploymentContractService::class)->issue($this->companyId, $this->employee(), [
            'type' => ContractType::FixedTerm->value, 'start_date' => '2026-01-01',
        ]);
    }

    public function test_a_contract_cannot_end_before_it_starts(): void
    {
        $this->expectException(WorkforceException::class);

        app(EmploymentContractService::class)->issue($this->companyId, $this->employee(), [
            'type' => ContractType::FixedTerm->value,
            'start_date' => '2026-06-01', 'end_date' => '2026-01-01',
        ]);
    }

    public function test_contract_lifecycle_moves_draft_to_active_to_terminated(): void
    {
        $contracts = app(EmploymentContractService::class);
        $contract = $contracts->issue($this->companyId, $this->employee(), [
            'type' => ContractType::Permanent->value, 'start_date' => '2026-01-01',
        ]);

        $this->assertSame(ContractStatus::Draft, $contract->status);
        $this->assertStringStartsWith('CTR-', (string) $contract->contract_number);

        $active = $contracts->activate($contract);
        $this->assertSame(ContractStatus::Active, $active->status);
        $this->assertNotNull($active->activated_at);

        $terminated = $contracts->terminate($active, 'Mutual agreement');
        $this->assertSame(ContractStatus::Terminated, $terminated->status);

        // Terminated is the end of the line.
        $this->expectException(WorkforceException::class);
        $contracts->activate($terminated->fresh());
    }

    // ═══ STRUCTURE & REPORTING ═══════════════════════════════════════════════════

    public function test_a_department_cannot_become_its_own_ancestor(): void
    {
        $departments = app(DepartmentService::class);
        $parent = $departments->create($this->companyId, ['code' => 'P', 'name' => 'Parent']);
        $child = $departments->create($this->companyId, ['code' => 'C', 'name' => 'Child', 'parent_id' => $parent->id]);

        $this->expectException(WorkforceException::class);
        $departments->update($parent, ['parent_id' => (string) $child->id]);
    }

    public function test_the_department_tree_nests_children_under_parents(): void
    {
        $departments = app(DepartmentService::class);
        $parent = $departments->create($this->companyId, ['code' => 'P', 'name' => 'Parent']);
        $departments->create($this->companyId, ['code' => 'C1', 'name' => 'Child One', 'parent_id' => $parent->id]);
        $departments->create($this->companyId, ['code' => 'C2', 'name' => 'Child Two', 'parent_id' => $parent->id]);

        $tree = $departments->tree($this->companyId);

        $this->assertCount(1, $tree);
        $this->assertSame('Parent', $tree[0]['name']);
        $this->assertCount(2, $tree[0]['children']);
    }

    public function test_the_reporting_chain_cannot_be_bent_into_a_cycle(): void
    {
        $lines = app(ReportingLineService::class);
        $chief = $this->employee('Chief');
        $manager = $this->employee('Manager');
        $junior = $this->employee('Junior');

        $lines->assignManager($manager, $chief);
        $lines->assignManager($junior, $manager);

        // Chief reporting to Junior would close the loop.
        $this->expectException(WorkforceException::class);
        $lines->assignManager($chief, $junior);
    }

    public function test_nobody_can_report_to_themselves(): void
    {
        $employee = $this->employee();

        $this->expectException(WorkforceException::class);
        app(ReportingLineService::class)->assignManager($employee, $employee);
    }

    public function test_reassigning_a_manager_closes_the_previous_line_rather_than_deleting_it(): void
    {
        $lines = app(ReportingLineService::class);
        $employee = $this->employee('Junior');
        $first = $this->employee('First');
        $second = $this->employee('Second');

        $lines->assignManager($employee, $first);
        $lines->assignManager($employee, $second);

        $this->assertSame((string) $second->id, (string) $lines->currentManager($employee)?->id);
        // Both lines survive; only one is still open.
        $this->assertSame(2, $employee->reportingLines()->count());
        $this->assertSame(1, $employee->reportingLines()->whereNull('effective_to')->count());
    }

    public function test_the_management_chain_walks_upward(): void
    {
        $lines = app(ReportingLineService::class);
        $chief = $this->employee('Chief');
        $manager = $this->employee('Manager');
        $junior = $this->employee('Junior');

        $lines->assignManager($manager, $chief);
        $lines->assignManager($junior, $manager);

        $chain = $lines->managementChain($junior);

        $this->assertCount(2, $chain);
        $this->assertSame((string) $manager->id, (string) $chain[0]->id);
        $this->assertSame((string) $chief->id, (string) $chain[1]->id);
    }

    public function test_the_organization_chart_nests_reports_under_their_manager(): void
    {
        $lines = app(ReportingLineService::class);
        $chief = $this->employee('Chief');
        $manager = $this->employee('Manager');
        $junior = $this->employee('Junior');

        $lines->assignManager($manager, $chief);
        $lines->assignManager($junior, $manager);

        $chart = app(OrganizationChartService::class)->build($this->companyId);

        $this->assertSame(3, $chart['employees']);
        $this->assertCount(1, $chart['roots']);                       // only the chief has no manager
        $this->assertSame('Chief Hassan', $chart['roots'][0]['name']);
        $this->assertCount(1, $chart['roots'][0]['children']);
        $this->assertSame('Junior Hassan', $chart['roots'][0]['children'][0]['children'][0]['name']);
        $this->assertSame(0, $chart['unassigned']);
    }

    // ═══ EMPLOYEE 360 ════════════════════════════════════════════════════════════

    public function test_employee_360_assembles_identity_placement_contract_and_reporting(): void
    {
        $department = app(DepartmentService::class)->create($this->companyId, ['code' => 'SLS', 'name' => 'Sales']);
        $position = app(WorkforceStructureService::class)->createPosition($this->companyId, ['code' => 'REP', 'title' => 'Sales Rep']);

        $manager = $this->employee('Manager');
        $employee = $this->employee('Amir', [
            'department_id' => $department->id,
            'position_id' => $position->id,
            'hire_date' => '2026-01-01',
        ]);

        app(ReportingLineService::class)->assignManager($employee, $manager);

        $contract = app(EmploymentContractService::class)->issue($this->companyId, $employee, [
            'type' => ContractType::Permanent->value, 'start_date' => '2026-01-01', 'weekly_hours' => 40,
        ]);
        app(EmploymentContractService::class)->activate($contract);

        app(EmployeeDocumentService::class)->attach($employee, [
            'type' => 'national_id', 'title' => 'National ID', 'expires_at' => '2030-01-01',
        ]);

        $view = app(Employee360Service::class)->build($employee->fresh());

        $this->assertSame('Amir Hassan', $view['identity']['name']);
        $this->assertSame('Sales', $view['placement']['department']['name']);
        $this->assertSame('Sales Rep', $view['placement']['position']['title']);
        $this->assertNotNull($view['contract']);
        $this->assertSame('active', $view['contract']['status']);
        $this->assertSame('Manager Hassan', $view['reporting']['manager']['name']);
        $this->assertCount(1, $view['documents']);
        // Attendance is answered through the H1 port, by the Attendance context.
        $this->assertArrayHasKey('attendance', $view);
        $this->assertArrayHasKey('attendance_rate_percent', $view['attendance']);
    }

    public function test_expiring_documents_are_surfaced_before_they_lapse(): void
    {
        $employee = $this->employee();
        $documents = app(EmployeeDocumentService::class);

        $documents->attach($employee, ['type' => 'work_permit', 'title' => 'Permit', 'expires_at' => now()->addDays(10)->toDateString()]);
        $documents->attach($employee, ['type' => 'passport', 'title' => 'Passport', 'expires_at' => now()->addYears(5)->toDateString()]);

        $expiring = $documents->expiringWithin($this->companyId, 30);

        $this->assertCount(1, $expiring);
        $this->assertSame('Permit', $expiring->first()->title);
    }

    // ═══ SECURITY ════════════════════════════════════════════════════════════════

    public function test_hr_routes_require_authentication(): void
    {
        $this->getJson('/api/hr/employees')->assertUnauthorized();
        $this->getJson('/api/hr/organization-chart')->assertUnauthorized();
        $this->getJson('/api/hr/departments')->assertUnauthorized();
    }
}
