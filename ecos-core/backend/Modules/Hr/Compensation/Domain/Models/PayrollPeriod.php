<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Hr\Compensation\Domain\Enums\PayrollPeriodStatus;

/** The window compensation is calculated over. */
class PayrollPeriod extends Model
{
    use HasUuids;

    protected $table = 'hr_payroll_periods';

    protected $fillable = [
        'company_id', 'code', 'name', 'start_date', 'end_date', 'payment_date',
        'status', 'currency', 'calculated_at', 'approved_at', 'closed_at', 'approved_by', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'status' => PayrollPeriodStatus::class,
            'start_date' => 'date',
            'end_date' => 'date',
            'payment_date' => 'date',
            'calculated_at' => 'datetime',
            'approved_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    public function runs(): HasMany
    {
        return $this->hasMany(PayrollRun::class, 'payroll_period_id');
    }

    public function payslips(): HasMany
    {
        return $this->hasMany(Payslip::class, 'payroll_period_id');
    }

    /** The run that counts — the approved one, else the most recent. */
    public function currentRun(): ?PayrollRun
    {
        return $this->runs()
            ->orderByRaw("case when status = 'approved' then 0 else 1 end")
            ->latest('created_at')
            ->first();
    }

    public function isFinal(): bool
    {
        return $this->status->isFinal();
    }
}
