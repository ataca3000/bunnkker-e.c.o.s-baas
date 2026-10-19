<?php

declare(strict_types=1);

namespace Modules\Hr\Workforce\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Hr\Workforce\Domain\Contracts\ProvidesAttendanceSummary;
use Modules\Hr\Workforce\Domain\Models\Employee;
use Modules\Hr\Workforce\Domain\Models\EmployeeDocument;

/**
 * Employee 360 — everything known about one person, assembled on read.
 *
 * Identity, where they sit, their terms, who they report to and who reports to
 * them, their documents, and a recent attendance summary fetched through the
 * H1 port so this service never calculates attendance itself.
 */
final class Employee360Service
{
    public function __construct(
        private readonly ReportingLineService $reportingLines,
        private readonly ProvidesAttendanceSummary $attendance,
    ) {}

    /** @return array<string, mixed> */
    public function build(Employee $employee, int $attendanceDays = 30): array
    {
        $employee->loadMissing(['department', 'position', 'jobGrade', 'employmentType']);

        $manager = $this->reportingLines->currentManager($employee);
        $reports = $this->reportingLines->directReports($employee);
        $contract = $employee->activeContract();

        $to = Carbon::now();
        $from = $to->copy()->subDays($attendanceDays - 1);

        return [
            'identity' => [
                'id' => $employee->id,
                'employee_number' => $employee->employee_number,
                'name' => $employee->fullName(),
                'first_name' => $employee->first_name,
                'last_name' => $employee->last_name,
                'status' => $employee->status->value,
                'status_label' => $employee->status->label(),
                'gender' => $employee->gender,
                'date_of_birth' => $employee->date_of_birth?->toDateString(),
                'national_id' => $employee->national_id,
                'photo_path' => $employee->photo_path,
                'user_id' => $employee->user_id,
            ],
            'contact' => [
                'work_email' => $employee->work_email,
                'personal_email' => $employee->personal_email,
                'phone' => $employee->phone,
                'mobile' => $employee->mobile,
                'address' => $employee->address,
                'city' => $employee->city,
                'country' => $employee->country,
                'emergency_contact_name' => $employee->emergency_contact_name,
                'emergency_contact_phone' => $employee->emergency_contact_phone,
            ],
            'placement' => [
                'company_id' => $employee->company_id,
                'branch_id' => $employee->branch_id,
                'department' => $employee->department?->only(['id', 'code', 'name']),
                'position' => $employee->position?->only(['id', 'code', 'title']),
                'job_grade' => $employee->jobGrade?->only(['id', 'code', 'name', 'level']),
                'employment_type' => $employee->employmentType?->only(['id', 'code', 'name']),
                'hire_date' => $employee->hire_date?->toDateString(),
                'tenure_days' => $employee->hire_date === null
                    ? null
                    : (int) floor((float) $employee->hire_date->diffInDays(Carbon::now())),
                'termination_date' => $employee->termination_date?->toDateString(),
                'termination_reason' => $employee->termination_reason,
            ],
            'contract' => $contract === null ? null : [
                'id' => $contract->id,
                'contract_number' => $contract->contract_number,
                'type' => $contract->type->value,
                'status' => $contract->status->value,
                'start_date' => $contract->start_date?->toDateString(),
                'end_date' => $contract->end_date?->toDateString(),
                'probation_end_date' => $contract->probation_end_date?->toDateString(),
                'weekly_hours' => $contract->weekly_hours,
                'days_until_expiry' => $contract->daysUntilExpiry(),
            ],
            'contracts_history' => $employee->contracts()->orderByDesc('start_date')->get()
                ->map(fn ($c) => [
                    'id' => $c->id,
                    'contract_number' => $c->contract_number,
                    'type' => $c->type->value,
                    'status' => $c->status->value,
                    'start_date' => $c->start_date?->toDateString(),
                    'end_date' => $c->end_date?->toDateString(),
                ])->all(),
            'reporting' => [
                'manager' => $manager === null ? null : [
                    'id' => $manager->id,
                    'name' => $manager->fullName(),
                    'employee_number' => $manager->employee_number,
                ],
                'management_chain' => collect($this->reportingLines->managementChain($employee))
                    ->map(fn (Employee $m) => ['id' => $m->id, 'name' => $m->fullName()])->all(),
                'direct_reports' => $reports->map(fn (Employee $r) => [
                    'id' => $r->id,
                    'name' => $r->fullName(),
                    'employee_number' => $r->employee_number,
                    'status' => $r->status->value,
                ])->all(),
            ],
            'documents' => $employee->documents()->orderByDesc('created_at')->get()
                ->map(fn (EmployeeDocument $d) => [
                    'id' => $d->id,
                    'type' => $d->type->value,
                    'title' => $d->title,
                    'file_name' => $d->file_name,
                    'issued_at' => $d->issued_at?->toDateString(),
                    'expires_at' => $d->expires_at?->toDateString(),
                    'is_expired' => $d->isExpired(),
                    'days_until_expiry' => $d->daysUntilExpiry(),
                ])->all(),
            // Owned by the Attendance context, fetched through the H1 port.
            'attendance' => $this->attendance->summaryFor(
                (string) $employee->id, $from->toDateString(), $to->toDateString()
            ),
        ];
    }
}
