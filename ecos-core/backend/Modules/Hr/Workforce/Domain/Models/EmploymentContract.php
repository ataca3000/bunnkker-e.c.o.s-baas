<?php

declare(strict_types=1);

namespace Modules\Hr\Workforce\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Modules\Hr\Workforce\Domain\Enums\ContractStatus;
use Modules\Hr\Workforce\Domain\Enums\ContractType;

/**
 * The terms an employee is engaged on — type, dates, position and hours.
 *
 * No compensation fields: Payroll owns pay, and a second copy of a salary is a
 * second version of the truth.
 */
class EmploymentContract extends Model
{
    use HasUuids;

    protected $table = 'hr_employment_contracts';

    protected $fillable = [
        'company_id', 'employee_id', 'position_id', 'job_grade_id', 'employment_type_id',
        'contract_number', 'type', 'status', 'start_date', 'end_date', 'probation_end_date',
        'weekly_hours', 'signed_at', 'activated_at', 'terminated_at', 'termination_reason',
        'notes', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'type' => ContractType::class,
            'status' => ContractStatus::class,
            'start_date' => 'date',
            'end_date' => 'date',
            'probation_end_date' => 'date',
            'weekly_hours' => 'decimal:2',
            'signed_at' => 'datetime',
            'activated_at' => 'datetime',
            'terminated_at' => 'datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function position(): BelongsTo
    {
        return $this->belongsTo(Position::class, 'position_id');
    }

    public function isActive(): bool
    {
        return $this->status === ContractStatus::Active;
    }

    /** Whether a fixed-term contract has run past its end date. */
    public function hasLapsed(?Carbon $asOf = null): bool
    {
        if ($this->end_date === null) {
            return false;
        }

        return $this->end_date->lessThan($asOf ?? Carbon::now()->startOfDay());
    }

    /** Days until expiry — negative once lapsed, null for open-ended contracts. */
    public function daysUntilExpiry(?Carbon $asOf = null): ?int
    {
        if ($this->end_date === null) {
            return null;
        }

        $from = ($asOf ?? Carbon::now())->startOfDay();

        return (int) round($from->diffInDays($this->end_date->copy()->startOfDay(), false));
    }
}
