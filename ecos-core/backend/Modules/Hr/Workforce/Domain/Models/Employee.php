<?php

declare(strict_types=1);

namespace Modules\Hr\Workforce\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\Hr\Workforce\Domain\Enums\ContractStatus;
use Modules\Hr\Workforce\Domain\Enums\EmployeeStatus;

/**
 * The Employee — the single source of truth for workforce identity.
 *
 * ┌─ ONE PERSON · ONE RECORD · REFERENCED BY EVERY MODULE ──────────────────┐
 * │ Shipping's driver, Inventory's warehouse operative, Manufacturing's         │
 * │ operator, Commerce's and CRM's salesperson are all THIS row, held by id.    │
 * │ Nothing about a person is stored twice, so nothing about a person can be    │
 * │ true in one module and stale in another.                                   │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class Employee extends Model
{
    use HasUuids;
    use SoftDeletes;

    protected $table = 'hr_employees';

    protected $fillable = [
        'company_id', 'branch_id', 'department_id', 'position_id', 'job_grade_id',
        'employment_type_id', 'user_id', 'employee_number',
        'first_name', 'last_name', 'display_name', 'national_id', 'gender', 'date_of_birth',
        'work_email', 'personal_email', 'phone', 'mobile', 'address', 'city', 'country',
        'emergency_contact_name', 'emergency_contact_phone',
        'hire_date', 'termination_date', 'termination_reason', 'status',
        'photo_path', 'notes', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'status' => EmployeeStatus::class,
            'date_of_birth' => 'date',
            'hire_date' => 'date',
            'termination_date' => 'date',
        ];
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    public function position(): BelongsTo
    {
        return $this->belongsTo(Position::class, 'position_id');
    }

    public function jobGrade(): BelongsTo
    {
        return $this->belongsTo(JobGrade::class, 'job_grade_id');
    }

    public function employmentType(): BelongsTo
    {
        return $this->belongsTo(EmploymentType::class, 'employment_type_id');
    }

    public function contracts(): HasMany
    {
        return $this->hasMany(EmploymentContract::class, 'employee_id');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(EmployeeDocument::class, 'employee_id');
    }

    /** The lines where this person is the subordinate. */
    public function reportingLines(): HasMany
    {
        return $this->hasMany(ReportingLine::class, 'employee_id');
    }

    /** The lines where this person is the manager. */
    public function directReportLines(): HasMany
    {
        return $this->hasMany(ReportingLine::class, 'manager_employee_id');
    }

    public function fullName(): string
    {
        return $this->display_name
            ?: trim(((string) $this->first_name).' '.((string) $this->last_name));
    }

    public function isEmployed(): bool
    {
        return $this->status instanceof EmployeeStatus && $this->status->isEmployed();
    }

    /** The contract currently in force, if there is one. */
    public function activeContract(): ?EmploymentContract
    {
        return $this->contracts()
            ->where('status', ContractStatus::Active->value)
            ->latest('start_date')
            ->first();
    }
}
