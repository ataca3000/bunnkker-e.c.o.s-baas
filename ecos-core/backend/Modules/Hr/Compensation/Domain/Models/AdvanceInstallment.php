<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Hr\Compensation\Domain\Enums\InstallmentStatus;

/** One scheduled recovery of an advance. */
class AdvanceInstallment extends Model
{
    use HasUuids;

    protected $table = 'hr_advance_installments';

    protected $fillable = [
        'company_id', 'advance_id', 'payroll_period_id', 'sequence', 'amount',
        'due_date', 'status', 'recovered_at', 'payslip_id', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'status' => InstallmentStatus::class,
            'amount' => 'decimal:2',
            'sequence' => 'integer',
            'due_date' => 'date',
            'recovered_at' => 'datetime',
        ];
    }

    public function advance(): BelongsTo
    {
        return $this->belongsTo(Advance::class, 'advance_id');
    }

    /** Installments due on or before a date and not yet taken. */
    public function scopeDueBy(Builder $query, string $date): Builder
    {
        return $query->where('status', InstallmentStatus::Scheduled->value)
            ->whereDate('due_date', '<=', $date);
    }
}
