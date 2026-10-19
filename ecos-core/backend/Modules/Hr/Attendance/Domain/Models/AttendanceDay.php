<?php

declare(strict_types=1);

namespace Modules\Hr\Attendance\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Hr\Attendance\Domain\Enums\AttendanceStatus;
use Modules\Hr\Workforce\Domain\Models\Department;
use Modules\Hr\Workforce\Domain\Models\Employee;

/**
 * One employee, one day, one recorded outcome.
 *
 * Check-in and check-out are optional notes of when someone arrived and left.
 * They are never totalled: no worked hours, no overtime, no time off in lieu.
 */
class AttendanceDay extends Model
{
    use HasUuids;

    protected $table = 'hr_attendance_days';

    protected $fillable = [
        'company_id', 'employee_id', 'department_id', 'shift_id',
        'work_date', 'status', 'check_in', 'check_out',
        'source', 'leave_request_id', 'notes', 'registered_by',
    ];

    protected function casts(): array
    {
        return [
            'status' => AttendanceStatus::class,
            'work_date' => 'date',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    public function shift(): BelongsTo
    {
        return $this->belongsTo(Shift::class, 'shift_id');
    }

    public function leaveRequest(): BelongsTo
    {
        return $this->belongsTo(LeaveRequest::class, 'leave_request_id');
    }
}
