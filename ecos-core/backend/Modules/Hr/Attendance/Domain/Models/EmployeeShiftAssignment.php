<?php

declare(strict_types=1);

namespace Modules\Hr\Attendance\Domain\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Hr\Workforce\Domain\Models\Employee;

/** Which shift an employee works, and from when. */
class EmployeeShiftAssignment extends Model
{
    use HasUuids;

    protected $table = 'hr_employee_shift_assignments';

    protected $fillable = ['company_id', 'employee_id', 'shift_id', 'effective_from', 'effective_to'];

    protected function casts(): array
    {
        return ['effective_from' => 'date', 'effective_to' => 'date'];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function shift(): BelongsTo
    {
        return $this->belongsTo(Shift::class, 'shift_id');
    }

    public function scopeCurrent(Builder $query): Builder
    {
        return $query->whereNull('effective_to');
    }
}
