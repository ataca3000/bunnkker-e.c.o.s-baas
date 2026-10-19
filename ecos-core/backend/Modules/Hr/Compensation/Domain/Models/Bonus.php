<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Hr\Compensation\Domain\Enums\ApprovalStatus;
use Modules\Hr\Compensation\Domain\Enums\BonusType;
use Modules\Hr\Workforce\Domain\Models\Employee;

/** Money added to a period, entered by hand or arriving from a performance decision. */
class Bonus extends Model
{
    use HasUuids;

    protected $table = 'hr_bonuses';

    protected $fillable = [
        'company_id', 'employee_id', 'payroll_period_id', 'type', 'amount', 'currency',
        'reason', 'awarded_on', 'status', 'source', 'recommendation_id',
        'approved_by', 'approved_at', 'notes', 'created_by',
        // Part 6 — the decision audit: what was proposed, and why it was granted.
        'recommended_amount', 'approval_reason',
    ];

    protected function casts(): array
    {
        return [
            'type' => BonusType::class,
            'status' => ApprovalStatus::class,
            'amount' => 'decimal:2',
            'recommended_amount' => 'decimal:2',
            'awarded_on' => 'date',
            'approved_at' => 'datetime',
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

    public function scopeApproved(Builder $query): Builder
    {
        return $query->where('status', ApprovalStatus::Approved->value);
    }

    public function affectsPay(): bool
    {
        return $this->status->affectsPay();
    }
}
