<?php

declare(strict_types=1);

namespace Modules\Hr\Workforce\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Hr\Workforce\Domain\Enums\EmployeeStatus;
use Modules\Hr\Workforce\Domain\Exceptions\WorkforceException;
use Modules\Hr\Workforce\Domain\Models\Employee;
use Modules\Hr\Workforce\Domain\Models\Position;

/**
 * The employee master — creating people, moving them, and ending their employment.
 *
 * ┌─ ONE PLACE WHERE WORKFORCE IDENTITY CHANGES ───────────────────────────┐
 * │ Every module that references an employee reads through this record, so     │
 * │ every change to it happens here, under the status machine and the headcount │
 * │ rules. Nothing else writes `hr_employees`.                                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class EmployeeService
{
    public function create(string $companyId, array $data, ?int $actorId = null): Employee
    {
        return DB::transaction(function () use ($companyId, $data, $actorId): Employee {
            $positionId = $data['position_id'] ?? null;
            if ($positionId !== null) {
                $this->assertPositionHasVacancy((string) $positionId);
            }

            $status = $this->resolveStatus($data['status'] ?? null) ?? EmployeeStatus::Active;

            return Employee::create([
                'company_id' => $companyId,
                'branch_id' => $data['branch_id'] ?? null,
                'department_id' => $data['department_id'] ?? null,
                'position_id' => $positionId,
                'job_grade_id' => $data['job_grade_id'] ?? null,
                'employment_type_id' => $data['employment_type_id'] ?? null,
                'user_id' => $data['user_id'] ?? null,
                'employee_number' => $data['employee_number'] ?? $this->nextEmployeeNumber($companyId),
                'first_name' => $data['first_name'],
                'last_name' => $data['last_name'],
                'display_name' => $data['display_name'] ?? null,
                'national_id' => $data['national_id'] ?? null,
                'gender' => $data['gender'] ?? null,
                'date_of_birth' => $data['date_of_birth'] ?? null,
                'work_email' => $data['work_email'] ?? null,
                'personal_email' => $data['personal_email'] ?? null,
                'phone' => $data['phone'] ?? null,
                'mobile' => $data['mobile'] ?? null,
                'address' => $data['address'] ?? null,
                'city' => $data['city'] ?? null,
                'country' => $data['country'] ?? null,
                'emergency_contact_name' => $data['emergency_contact_name'] ?? null,
                'emergency_contact_phone' => $data['emergency_contact_phone'] ?? null,
                'hire_date' => $data['hire_date'] ?? Carbon::now()->toDateString(),
                'status' => $status->value,
                'notes' => $data['notes'] ?? null,
                'created_by' => $actorId,
            ]);
        });
    }

    public function update(Employee $employee, array $data): Employee
    {
        // Status changes go through changeStatus() so the machine is never bypassed.
        unset($data['status'], $data['company_id'], $data['employee_number']);

        if (! empty($data['position_id']) && (string) $data['position_id'] !== (string) $employee->position_id) {
            $this->assertPositionHasVacancy((string) $data['position_id']);
        }

        $employee->update(array_intersect_key($data, array_flip([
            'branch_id', 'department_id', 'position_id', 'job_grade_id', 'employment_type_id', 'user_id',
            'first_name', 'last_name', 'display_name', 'national_id', 'gender', 'date_of_birth',
            'work_email', 'personal_email', 'phone', 'mobile', 'address', 'city', 'country',
            'emergency_contact_name', 'emergency_contact_phone', 'hire_date', 'photo_path', 'notes',
        ])));

        return $employee->refresh();
    }

    /**
     * Move someone to another department, branch or position. A transfer is an
     * ordinary update, but naming it makes the intent legible at the call site
     * and keeps the vacancy check in one place.
     */
    public function transfer(Employee $employee, array $destination): Employee
    {
        if (! empty($destination['position_id']) && (string) $destination['position_id'] !== (string) $employee->position_id) {
            $this->assertPositionHasVacancy((string) $destination['position_id']);
        }

        $employee->update(array_intersect_key($destination, array_flip([
            'department_id', 'branch_id', 'position_id', 'job_grade_id',
        ])));

        return $employee->refresh();
    }

    public function changeStatus(Employee $employee, EmployeeStatus $target): Employee
    {
        $current = $employee->status;

        if ($current === $target) {
            return $employee;
        }

        if (! $current->canTransitionTo($target)) {
            throw WorkforceException::invalidStatusTransition($current->value, $target->value);
        }

        $employee->update(['status' => $target->value]);

        return $employee->refresh();
    }

    /** End someone's employment. Terminal — a returning employee is rehired, not restored. */
    public function terminate(Employee $employee, string $reason, ?string $date = null, bool $resigned = false): Employee
    {
        if (! $employee->isEmployed()) {
            throw WorkforceException::alreadyTerminated();
        }

        $target = $resigned ? EmployeeStatus::Resigned : EmployeeStatus::Terminated;

        if (! $employee->status->canTransitionTo($target)) {
            throw WorkforceException::invalidStatusTransition($employee->status->value, $target->value);
        }

        $employee->update([
            'status' => $target->value,
            'termination_date' => $date ?? Carbon::now()->toDateString(),
            'termination_reason' => $reason,
        ]);

        return $employee->refresh();
    }

    /**
     * The next employee number for a company: EMP-0001, EMP-0002 … Derived from
     * the highest existing number so a deleted record never causes a reissue.
     */
    public function nextEmployeeNumber(string $companyId): string
    {
        $last = Employee::withTrashed()
            ->where('company_id', $companyId)
            ->where('employee_number', 'like', 'EMP-%')
            ->orderByDesc('employee_number')
            ->value('employee_number');

        $next = $last === null ? 1 : ((int) substr((string) $last, 4)) + 1;

        return 'EMP-'.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private function assertPositionHasVacancy(string $positionId): void
    {
        $position = Position::find($positionId);

        if ($position !== null && ! $position->hasVacancy()) {
            throw WorkforceException::positionFull((string) $position->title);
        }
    }

    private function resolveStatus(mixed $status): ?EmployeeStatus
    {
        if ($status instanceof EmployeeStatus) {
            return $status;
        }

        return is_string($status) ? EmployeeStatus::tryFrom($status) : null;
    }
}
