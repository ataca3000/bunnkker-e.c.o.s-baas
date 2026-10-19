<?php

declare(strict_types=1);

namespace Tests\Feature\Hr;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Carbon;
use Modules\Hr\Attendance\Domain\Enums\AttendanceStatus;
use Modules\Hr\Attendance\Domain\Enums\LeavePayrollFlag;
use Modules\Hr\Attendance\Domain\Enums\LeaveStatus;
use Modules\Hr\Attendance\Domain\Exceptions\AttendanceException;
use Modules\Hr\Attendance\Domain\Models\AttendanceDay;
use Modules\Hr\Attendance\Domain\Services\AttendanceRegistrationService;
use Modules\Hr\Attendance\Domain\Services\HolidayService;
use Modules\Hr\Attendance\Domain\Services\LeaveRequestService;
use Modules\Hr\Attendance\Domain\Services\WorkforceAvailabilityService;
use Modules\Hr\Attendance\Domain\Services\WorkScheduleService;
use Modules\Hr\Workforce\Domain\Models\Employee;
use Modules\Hr\Workforce\Domain\Services\DepartmentService;
use Modules\Hr\Workforce\Domain\Services\EmployeeService;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * HR & Workforce OS — EPIC H2. Attendance & Workforce Availability.
 *
 * Protects the operational guarantees: registration is manual and idempotent,
 * approving leave writes the days onto the attendance record, the payroll flag
 * travels with the request, and the availability dashboards count what is
 * actually registered rather than assuming anybody turned up.
 */
class AttendanceAvailabilityTest extends TestCase
{
    use DatabaseTransactions;

    private string $companyId;

    /** Attendance is date-scoped, so the clock is pinned. */
    private const NOW = '2026-04-15 09:00:00';

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

    private function today(): string
    {
        return Carbon::parse(self::NOW)->toDateString();
    }

    // ═══ MANUAL REGISTRATION ═════════════════════════════════════════════════════

    public function test_registering_the_same_day_twice_corrects_rather_than_duplicates(): void
    {
        $employee = $this->employee();
        $attendance = app(AttendanceRegistrationService::class);

        $attendance->register($employee, $this->today(), AttendanceStatus::Absent);
        $corrected = $attendance->register($employee, $this->today(), AttendanceStatus::Present, ['check_in' => '09:05']);

        $this->assertSame(1, AttendanceDay::where('employee_id', $employee->id)->count());
        $this->assertSame(AttendanceStatus::Present, $corrected->status);
        $this->assertSame('manual', $corrected->source);
    }

    public function test_attendance_cannot_be_registered_for_a_future_date(): void
    {
        $this->expectException(AttendanceException::class);

        app(AttendanceRegistrationService::class)->register(
            $this->employee(), Carbon::parse(self::NOW)->addDay()->toDateString(), AttendanceStatus::Present
        );
    }

    public function test_attendance_cannot_be_registered_for_someone_who_has_left(): void
    {
        $employee = app(EmployeeService::class)->terminate($this->employee(), 'Left');

        $this->expectException(AttendanceException::class);
        app(AttendanceRegistrationService::class)->register($employee->fresh(), $this->today(), AttendanceStatus::Present);
    }

    public function test_a_whole_team_can_be_registered_in_one_pass(): void
    {
        $a = $this->employee('Amir');
        $b = $this->employee('Nour');

        $result = app(AttendanceRegistrationService::class)->registerMany($this->companyId, $this->today(), [
            ['employee_id' => (string) $a->id, 'status' => 'present', 'check_in' => '09:00'],
            ['employee_id' => (string) $b->id, 'status' => 'absent'],
            ['employee_id' => (string) $a->id, 'status' => 'not_a_status'],   // rejected, not silently accepted
        ]);

        $this->assertSame(2, $result['registered']);
        $this->assertCount(1, $result['skipped']);
    }

    public function test_the_register_sheet_suggests_a_holiday_when_the_company_is_closed(): void
    {
        $this->employee();
        app(HolidayService::class)->create($this->companyId, [
            'name' => 'Eid Al-Fitr', 'start_date' => $this->today(), 'end_date' => $this->today(), 'type' => 'religious',
        ]);

        $sheet = app(AttendanceRegistrationService::class)->sheet($this->companyId, $this->today());

        $this->assertSame(AttendanceStatus::Holiday->value, $sheet['suggested_status']);
        $this->assertSame('Eid Al-Fitr', $sheet['holiday']['name']);
        $this->assertCount(1, $sheet['employees']);
        $this->assertFalse($sheet['employees'][0]['registered']);
    }

    public function test_the_register_sheet_lists_everyone_with_what_is_already_recorded(): void
    {
        $registered = $this->employee('Amir');
        $this->employee('Nour');
        app(AttendanceRegistrationService::class)->register($registered, $this->today(), AttendanceStatus::Present);

        $sheet = app(AttendanceRegistrationService::class)->sheet($this->companyId, $this->today());
        $rows = collect($sheet['employees']);

        $this->assertCount(2, $rows);
        $this->assertTrue($rows->firstWhere('employee_id', $registered->id)['registered']);
        $this->assertFalse($rows->firstWhere('name', 'Nour Hassan')['registered']);
    }

    // ═══ SHIFTS & CALENDARS ══════════════════════════════════════════════════════

    public function test_assigning_a_shift_closes_the_previous_assignment(): void
    {
        $schedule = app(WorkScheduleService::class);
        $employee = $this->employee();

        $morning = $schedule->createShift($this->companyId, ['code' => 'AM', 'name' => 'Morning', 'start_time' => '08:00', 'end_time' => '16:00']);
        $night = $schedule->createShift($this->companyId, ['code' => 'PM', 'name' => 'Night', 'start_time' => '20:00', 'end_time' => '04:00', 'crosses_midnight' => true]);

        $schedule->assignShift($employee, $morning);
        $schedule->assignShift($employee, $night);

        $this->assertSame((string) $night->id, (string) $schedule->currentShift($employee)?->id);
    }

    public function test_the_work_calendar_decides_which_weekdays_are_worked(): void
    {
        $schedule = app(WorkScheduleService::class);
        // Sunday to Thursday.
        $schedule->createCalendar($this->companyId, [
            'code' => 'std', 'name' => 'Standard', 'working_days' => [7, 1, 2, 3, 4], 'is_default' => true,
        ]);

        // 2026-04-15 is a Wednesday (ISO 3), 2026-04-17 a Friday (ISO 5).
        $this->assertTrue($schedule->isWorkingDay($this->companyId, Carbon::parse('2026-04-15')));
        $this->assertFalse($schedule->isWorkingDay($this->companyId, Carbon::parse('2026-04-17')));
    }

    // ═══ LEAVE & MANAGER APPROVAL ════════════════════════════════════════════════

    public function test_approving_leave_writes_the_days_onto_the_attendance_record(): void
    {
        $employee = $this->employee();
        $manager = $this->employee('Manager');
        $leave = app(LeaveRequestService::class);

        $request = $leave->submit($employee, [
            'start_date' => '2026-04-13', 'end_date' => '2026-04-15',
            'payroll_flag' => LeavePayrollFlag::DoNotDeductSalary->value, 'reason' => 'Family',
        ]);

        $this->assertSame(3, $request->days_count);
        $this->assertSame(LeaveStatus::Pending, $request->status);
        $this->assertStringStartsWith('LV-', (string) $request->request_number);

        $approved = $leave->approve($request, $manager, 'Approved');

        $this->assertSame(LeaveStatus::Approved, $approved->status);
        $this->assertSame((string) $manager->id, (string) $approved->decided_by_employee_id);

        $days = AttendanceDay::where('leave_request_id', $approved->id)->get();
        $this->assertCount(3, $days);
        $this->assertTrue($days->every(fn (AttendanceDay $d) => $d->status === AttendanceStatus::Leave));
    }

    public function test_the_payroll_flag_travels_with_the_request(): void
    {
        $deducted = app(LeaveRequestService::class)->submit($this->employee('A'), [
            'start_date' => '2026-04-10', 'end_date' => '2026-04-10',
            'payroll_flag' => LeavePayrollFlag::DeductSalary->value,
        ]);
        $paid = app(LeaveRequestService::class)->submit($this->employee('B'), [
            'start_date' => '2026-04-10', 'end_date' => '2026-04-10',
            'payroll_flag' => LeavePayrollFlag::DoNotDeductSalary->value,
        ]);

        $this->assertTrue($deducted->deductsSalary());
        $this->assertFalse($paid->deductsSalary());
        $this->assertSame('Deduct Salary', $deducted->payroll_flag->label());
    }

    public function test_approved_leave_skips_days_the_company_was_already_closed(): void
    {
        $employee = $this->employee();
        app(HolidayService::class)->create($this->companyId, [
            'name' => 'Eid Al-Adha', 'start_date' => '2026-04-14', 'end_date' => '2026-04-14', 'type' => 'religious',
        ]);

        $request = app(LeaveRequestService::class)->submit($employee, [
            'start_date' => '2026-04-13', 'end_date' => '2026-04-15', 'payroll_flag' => 'deduct_salary',
        ]);
        $approved = app(LeaveRequestService::class)->approve($request);

        // Three days requested, but the holiday in the middle is not spent as leave.
        $this->assertSame(3, $approved->days_count);
        $this->assertSame(2, AttendanceDay::where('leave_request_id', $approved->id)->count());
    }

    public function test_cancelling_approved_leave_takes_back_exactly_the_days_it_wrote(): void
    {
        $employee = $this->employee();
        $leave = app(LeaveRequestService::class);

        $request = $leave->approve($leave->submit($employee, [
            'start_date' => '2026-04-13', 'end_date' => '2026-04-14', 'payroll_flag' => 'deduct_salary',
        ]));
        $this->assertSame(2, AttendanceDay::where('leave_request_id', $request->id)->count());

        $cancelled = $leave->cancel($request);

        $this->assertSame(LeaveStatus::Cancelled, $cancelled->status);
        $this->assertSame(0, AttendanceDay::where('leave_request_id', $request->id)->count());
    }

    public function test_overlapping_leave_for_the_same_employee_is_refused(): void
    {
        $employee = $this->employee();
        $leave = app(LeaveRequestService::class);

        $leave->submit($employee, ['start_date' => '2026-04-13', 'end_date' => '2026-04-15', 'payroll_flag' => 'deduct_salary']);

        $this->expectException(AttendanceException::class);
        $leave->submit($employee, ['start_date' => '2026-04-14', 'end_date' => '2026-04-16', 'payroll_flag' => 'deduct_salary']);
    }

    public function test_a_rejected_request_is_final_and_writes_no_attendance(): void
    {
        $employee = $this->employee();
        $leave = app(LeaveRequestService::class);

        $rejected = $leave->reject($leave->submit($employee, [
            'start_date' => '2026-04-13', 'end_date' => '2026-04-13', 'payroll_flag' => 'deduct_salary',
        ]), null, 'Peak season');

        $this->assertSame(LeaveStatus::Rejected, $rejected->status);
        $this->assertSame(0, AttendanceDay::where('leave_request_id', $rejected->id)->count());

        $this->expectException(AttendanceException::class);
        $leave->approve($rejected->fresh());
    }

    public function test_leave_cannot_end_before_it_starts(): void
    {
        $this->expectException(AttendanceException::class);

        app(LeaveRequestService::class)->submit($this->employee(), [
            'start_date' => '2026-04-15', 'end_date' => '2026-04-10', 'payroll_flag' => 'deduct_salary',
        ]);
    }

    // ═══ AVAILABILITY DASHBOARDS ═════════════════════════════════════════════════

    public function test_workforce_availability_counts_registered_days_and_reports_the_rest_as_unregistered(): void
    {
        $present = $this->employee('Amir');
        $absent = $this->employee('Nour');
        $this->employee('Unregistered');

        $attendance = app(AttendanceRegistrationService::class);
        $attendance->register($present, $this->today(), AttendanceStatus::Present);
        $attendance->register($absent, $this->today(), AttendanceStatus::Absent);

        $availability = app(WorkforceAvailabilityService::class)->forDate($this->companyId, $this->today());

        $this->assertSame(3, $availability['headcount']);
        $this->assertSame(2, $availability['registered']);
        $this->assertSame(1, $availability['unregistered']);   // never assumed present
        $this->assertSame(1, $availability['present']);
        $this->assertSame(1, $availability['absent']);
        $this->assertEqualsWithDelta(33.33, $availability['availability_percent'], 0.01);
    }

    public function test_department_attendance_breaks_availability_down_by_department(): void
    {
        $sales = app(DepartmentService::class)->create($this->companyId, ['code' => 'SLS', 'name' => 'Sales']);
        $ops = app(DepartmentService::class)->create($this->companyId, ['code' => 'OPS', 'name' => 'Operations']);

        $salesPerson = $this->employee('Amir', ['department_id' => $sales->id]);
        $opsPerson = $this->employee('Nour', ['department_id' => $ops->id]);

        $attendance = app(AttendanceRegistrationService::class);
        $attendance->register($salesPerson, $this->today(), AttendanceStatus::Present);
        $attendance->register($opsPerson, $this->today(), AttendanceStatus::Absent);

        $rows = collect(app(WorkforceAvailabilityService::class)->byDepartment($this->companyId, $this->today()));

        $this->assertSame(1, $rows->firstWhere('department', 'Sales')['present']);
        $this->assertSame(100.0, $rows->firstWhere('department', 'Sales')['availability_percent']);
        $this->assertSame(1, $rows->firstWhere('department', 'Operations')['absent']);
        $this->assertSame(0.0, $rows->firstWhere('department', 'Operations')['availability_percent']);
    }

    public function test_leave_shows_up_on_the_availability_dashboard_immediately(): void
    {
        $employee = $this->employee();
        $leave = app(LeaveRequestService::class);

        $leave->approve($leave->submit($employee, [
            'start_date' => $this->today(), 'end_date' => $this->today(), 'payroll_flag' => 'do_not_deduct_salary',
        ]));

        $availability = app(WorkforceAvailabilityService::class)->forDate($this->companyId, $this->today());

        $this->assertSame(1, $availability['on_leave']);
        $this->assertSame(0, $availability['present']);
    }

    public function test_attendance_routes_require_authentication(): void
    {
        $this->getJson('/api/hr/attendance/sheet')->assertUnauthorized();
        $this->getJson('/api/hr/attendance/availability')->assertUnauthorized();
        $this->getJson('/api/hr/leave/requests')->assertUnauthorized();
    }
}
