<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Hr\Compensation\Domain\Enums\ApprovalStatus;
use Modules\Hr\Compensation\Domain\Enums\DeductionType;
use Modules\Hr\Workforce\Domain\Models\Employee;

/** Money taken off pay, with the reason, decision and approver attached. */
class Deduction extends Model
{
    use HasUuids;

    protected $table = 'hr_deductions';

    protected $fillable = [
        'company_id', 'employee_id', 'payroll_period_id', 'type', 'amount', 'currency',
        'deduction_date', 'reason', 'decision', 'status', 'approver_id', 'decided_at',
        'notes', 'source_module', 'source_reference', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'type' => DeductionType::class,
            'status' => ApprovalStatus::class,
            'amount' => 'decimal:2',
            'deduction_date' => 'date',
            'decided_at' => 'datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function period(): BelongsTo
    {
        return $this->belongsTo(PayrollPeriod::class, 'payroll_period_id');
    }

    /** Only approved deductions ever reach a payslip. */
    public function scopeApproved(Builder $query): Builder
    {
        return $query->where('status', ApprovalStatus::Approved->value);
    }

    public function affectsPay(): bool
    {
        return $this->status->affectsPay();
    }
}
