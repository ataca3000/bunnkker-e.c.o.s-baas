<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Hr\Compensation\Domain\Enums\PayrollRunStatus;

/** One calculation of a payroll period, across every employee in it. */
class PayrollRun extends Model
{
    use HasUuids;

    protected $table = 'hr_payroll_runs';

    protected $fillable = [
        'company_id', 'payroll_period_id', 'reference', 'status', 'employees_count',
        'total_basic', 'total_bonus', 'total_commission', 'total_advances',
        'total_deductions', 'total_gross', 'total_net', 'currency',
        'calculated_at', 'approved_at', 'calculated_by', 'approved_by',
    ];

    protected function casts(): array
    {
        return [
            'status' => PayrollRunStatus::class,
            'employees_count' => 'integer',
            'total_basic' => 'decimal:2',
            'total_bonus' => 'decimal:2',
            'total_commission' => 'decimal:2',
            'total_advances' => 'decimal:2',
            'total_deductions' => 'decimal:2',
            'total_gross' => 'decimal:2',
            'total_net' => 'decimal:2',
            'calculated_at' => 'datetime',
            'approved_at' => 'datetime',
        ];
    }

    public function period(): BelongsTo
    {
        return $this->belongsTo(PayrollPeriod::class, 'payroll_period_id');
    }

    public function payslips(): HasMany
    {
        return $this->hasMany(Payslip::class, 'payroll_run_id');
    }

    public function isApproved(): bool
    {
        return $this->status->isApproved();
    }
}
