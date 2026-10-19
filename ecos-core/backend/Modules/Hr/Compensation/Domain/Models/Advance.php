<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Hr\Compensation\Domain\Enums\AdvanceStatus;
use Modules\Hr\Compensation\Domain\Enums\AdvanceType;
use Modules\Hr\Compensation\Domain\Enums\InstallmentStatus;
use Modules\Hr\Workforce\Domain\Models\Employee;

/**
 * Money advanced to an employee, recovered on a schedule.
 *
 * The remaining balance is DERIVED from the outstanding installments rather than
 * stored, so it can never drift from the schedule that produces it.
 */
class Advance extends Model
{
    use HasUuids;

    protected $table = 'hr_advances';

    protected $fillable = [
        'company_id', 'employee_id', 'reference', 'type', 'amount', 'currency',
        'installments_count', 'installment_amount', 'requested_on', 'first_recovery_date',
        'status', 'reason', 'approved_by', 'approved_at', 'settled_at', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'type' => AdvanceType::class,
            'status' => AdvanceStatus::class,
            'amount' => 'decimal:2',
            'installment_amount' => 'decimal:2',
            'installments_count' => 'integer',
            'requested_on' => 'date',
            'first_recovery_date' => 'date',
            'approved_at' => 'datetime',
            'settled_at' => 'datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function installments(): HasMany
    {
        return $this->hasMany(AdvanceInstallment::class, 'advance_id')->orderBy('sequence');
    }

    /** What is still owed — the sum of the installments not yet recovered. */
    public function remainingBalance(): float
    {
        return round((float) $this->installments()
            ->where('status', InstallmentStatus::Scheduled->value)
            ->sum('amount'), 2);
    }

    public function recoveredAmount(): float
    {
        return round((float) $this->installments()
            ->where('status', InstallmentStatus::Recovered->value)
            ->sum('amount'), 2);
    }

    public function isFullyRecovered(): bool
    {
        return $this->remainingBalance() <= 0.0;
    }
}
