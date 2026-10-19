<?php

declare(strict_types=1);

namespace Modules\Hr\Attendance\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Hr\Attendance\Domain\Enums\LeavePayrollFlag;
use Modules\Hr\Attendance\Domain\Enums\LeaveStatus;
use Modules\Hr\Workforce\Domain\Models\Employee;

/** A request for days off, its manager decision, and its instruction to Payroll. */
class LeaveRequest extends Model
{
    use HasUuids;

    protected $table = 'hr_leave_requests';

    protected $fillable = [
        'company_id', 'employee_id', 'request_number',
        'start_date', 'end_date', 'days_count', 'reason',
        'payroll_flag', 'status', 'decided_by_employee_id', 'decided_at',
        'decision_note', 'requested_by',
    ];

    protected function casts(): array
    {
        return [
            'status' => LeaveStatus::class,
            'payroll_flag' => LeavePayrollFlag::class,
            'start_date' => 'date',
            'end_date' => 'date',
            'days_count' => 'integer',
            'decided_at' => 'datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function decidedBy(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'decided_by_employee_id');
    }

    /** The attendance days this approval wrote. */
    public function attendanceDays(): HasMany
    {
        return $this->hasMany(AttendanceDay::class, 'leave_request_id');
    }

    public function isPending(): bool
    {
        return $this->status === LeaveStatus::Pending;
    }

    public function deductsSalary(): bool
    {
        return $this->payroll_flag instanceof LeavePayrollFlag && $this->payroll_flag->deducts();
    }
}
