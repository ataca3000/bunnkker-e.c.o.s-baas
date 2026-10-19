<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Hr\Compensation\Domain\Enums\AdjustmentComponent;
use Modules\Hr\Compensation\Domain\Enums\AdjustmentStatus;
use Modules\Hr\Workforce\Domain\Models\Employee;

/**
 * A correction against pay that has already been approved.
 *
 * Signed: positive pays more, negative recovers. The original it corrects is
 * referenced loosely — by type and id, with no foreign key — because the frozen
 * record must never be cascaded away by a correction that refers to it.
 */
class CompensationAdjustment extends Model
{
    use HasUuids;

    protected $table = 'hr_compensation_adjustments';

    protected $fillable = [
        'company_id', 'employee_id', 'reference',
        'original_period_id', 'payroll_period_id',
        'component', 'original_type', 'original_id', 'original_amount',
        'amount', 'currency', 'reason', 'notes', 'status',
        'requested_by', 'requested_at', 'approved_by', 'approved_at',
        'decision_note', 'applied_at', 'applied_payslip_id',
    ];

    protected function casts(): array
    {
        return [
            'component' => AdjustmentComponent::class,
            'status' => AdjustmentStatus::class,
            'amount' => 'decimal:2',
            'original_amount' => 'decimal:2',
            'requested_at' => 'datetime',
            'approved_at' => 'datetime',
            'applied_at' => 'datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    /** The open period that will carry this correction. */
    public function period(): BelongsTo
    {
        return $this->belongsTo(PayrollPeriod::class, 'payroll_period_id');
    }

    /** The locked period the mistake was made in. */
    public function originalPeriod(): BelongsTo
    {
        return $this->belongsTo(PayrollPeriod::class, 'original_period_id');
    }

    public function isCredit(): bool
    {
        return (float) $this->amount > 0;
    }

    /** Approved, and no payslip has carried it yet. */
    public function isOutstanding(): bool
    {
        return $this->status->isPayable();
    }

    public function scopePayableIn(Builder $query, string $periodId): Builder
    {
        return $query->where('payroll_period_id', $periodId)
            ->where('status', AdjustmentStatus::Approved->value);
    }

    /**
     * The whole decision, in the order someone reviewing it would ask.
     *
     * @return array<string, mixed>
     */
    public function auditTrail(): array
    {
        return [
            'reference' => $this->reference,
            'component' => $this->component->value,
            'corrects' => [
                'type' => $this->original_type,
                'id' => $this->original_id,
                'amount' => $this->original_amount === null ? null : (float) $this->original_amount,
                'period_id' => $this->original_period_id,
            ],
            'adjustment_amount' => (float) $this->amount,
            'direction' => $this->isCredit() ? 'pays more' : 'recovers',
            'reason' => $this->reason,
            'requested_by' => $this->requested_by,
            'requested_at' => $this->requested_at?->toDateTimeString(),
            'approved_by' => $this->approved_by,
            'approved_at' => $this->approved_at?->toDateTimeString(),
            'decision_note' => $this->decision_note,
            'applied_at' => $this->applied_at?->toDateTimeString(),
            'applied_payslip_id' => $this->applied_payslip_id,
            'status' => $this->status->value,
        ];
    }
}
