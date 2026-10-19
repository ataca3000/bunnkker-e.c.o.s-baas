<?php

declare(strict_types=1);

namespace Modules\Hr\Attendance\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Hr\Attendance\Domain\Enums\AttendanceStatus;
use Modules\Hr\Attendance\Domain\Exceptions\AttendanceException;
use Modules\Hr\Attendance\Domain\Models\AttendanceDay;
use Modules\Hr\Workforce\Domain\Models\Employee;

/**
 * Manual attendance registration.
 *
 * ┌─ A SUPERVISOR WRITES DOWN WHAT HAPPENED ────────────────────────────────┐
 * │ One row per employee per day, entered by a person. Registering the same day │
 * │ twice CORRECTS the record rather than duplicating it — a supervisor fixing  │
 * │ a mistake is the normal case, not an error.                                │
 * │                                                                            │
 * │ Deliberately absent: fingerprint readers, RFID, QR codes, GPS and mobile    │
 * │ capture. Also absent: worked hours, overtime and time off in lieu. Check-in │
 * │ and check-out are recorded as they were reported and never totalled.        │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class AttendanceRegistrationService
{
    public function __construct(
        private readonly HolidayService $holidays,
        private readonly WorkScheduleService $schedule,
    ) {}

    /**
     * Record one employee's day. Idempotent on (employee, date): a second call
     * updates the existing row.
     */
    public function register(
        Employee $employee,
        string $workDate,
        AttendanceStatus $status,
        array $data = [],
        ?int $actorId = null,
    ): AttendanceDay {
        if (! $employee->isEmployed()) {
            throw AttendanceException::employeeNotEmployed();
        }

        $date = Carbon::parse($workDate)->startOfDay();

        if ($date->greaterThan(Carbon::now()->startOfDay())) {
            throw AttendanceException::futureAttendance();
        }

        return DB::transaction(fn (): AttendanceDay => AttendanceDay::updateOrCreate(
            ['employee_id' => $employee->id, 'work_date' => $date->toDateString()],
            [
                'company_id' => $employee->company_id,
                'department_id' => $employee->department_id,
                'shift_id' => $data['shift_id'] ?? $this->schedule->currentShift($employee)?->id,
                'status' => $status->value,
                'check_in' => $data['check_in'] ?? null,
                'check_out' => $data['check_out'] ?? null,
                'source' => 'manual',
                'leave_request_id' => $data['leave_request_id'] ?? null,
                'notes' => $data['notes'] ?? null,
                'registered_by' => $actorId,
            ]
        ));
    }

    /**
     * Register a whole team for one date in a single pass — the way a supervisor
     * actually works at the start of a shift.
     *
     * @param  array<int, array{employee_id: string, status: string, check_in?: string, check_out?: string, notes?: string}>  $rows
     * @return array<string, mixed>
     */
    public function registerMany(string $companyId, string $workDate, array $rows, ?int $actorId = null): array
    {
        $employees = Employee::query()
            ->where('company_id', $companyId)
            ->whereIn('id', array_column($rows, 'employee_id'))
            ->get()->keyBy('id');

        $registered = 0;
        $skipped = [];

        foreach ($rows as $row) {
            $employee = $employees->get($row['employee_id']);
            $status = AttendanceStatus::tryFrom((string) ($row['status'] ?? ''));

            if ($employee === null || $status === null) {
                $skipped[] = ['employee_id' => $row['employee_id'] ?? null, 'reason' => 'unknown employee or status'];

                continue;
            }

            try {
                $this->register($employee, $workDate, $status, $row, $actorId);
                $registered++;
            } catch (AttendanceException $e) {
                $skipped[] = ['employee_id' => (string) $employee->id, 'reason' => $e->getMessage()];
            }
        }

        return ['work_date' => $workDate, 'registered' => $registered, 'skipped' => $skipped];
    }

    /**
     * The register sheet for a date: every employed person, with what has been
     * recorded so far and what the day is by default (holiday, rest day, or open).
     *
     * @return array<string, mixed>
     */
    public function sheet(string $companyId, string $workDate, ?string $departmentId = null): array
    {
        $date = Carbon::parse($workDate)->startOfDay();
        $holiday = $this->holidays->holidayOn($companyId, $date);
        $isWorkingDay = $this->schedule->isWorkingDay($companyId, $date);

        $employees = Employee::query()
            ->where('company_id', $companyId)
            ->whereNotIn('status', ['terminated', 'resigned'])
            ->when($departmentId !== null, fn ($q) => $q->where('department_id', $departmentId))
            ->with(['department:id,name', 'position:id,title'])
            ->orderBy('first_name')
            ->get();

        $recorded = AttendanceDay::query()
            ->where('company_id', $companyId)
            ->where('work_date', $date->toDateString())
            ->get()->keyBy('employee_id');

        $suggested = match (true) {
            $holiday !== null => AttendanceStatus::Holiday,
            ! $isWorkingDay => AttendanceStatus::RestDay,
            default => AttendanceStatus::Present,
        };

        return [
            'work_date' => $date->toDateString(),
            'is_working_day' => $isWorkingDay,
            'holiday' => $holiday === null ? null : [
                'id' => $holiday->id, 'name' => $holiday->name, 'type' => $holiday->type->value,
            ],
            'suggested_status' => $suggested->value,
            'employees' => $employees->map(function (Employee $e) use ($recorded) {
                $day = $recorded->get((string) $e->id);

                return [
                    'employee_id' => $e->id,
                    'employee_number' => $e->employee_number,
                    'name' => $e->fullName(),
                    'department' => $e->department?->name,
                    'position' => $e->position?->title,
                    'registered' => $day !== null,
                    'status' => $day?->status->value,
                    'check_in' => $day?->check_in,
                    'check_out' => $day?->check_out,
                    'notes' => $day?->notes,
                ];
            })->all(),
        ];
    }
}
