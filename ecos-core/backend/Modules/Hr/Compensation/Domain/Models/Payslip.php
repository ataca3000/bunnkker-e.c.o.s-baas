<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Hr\Workforce\Domain\Models\Employee;

/**
 * One employee's compensation for one period.
 *
 * The headline figures are here; the itemised lines and the stored explanation
 * are what make any of them auditable without re-running the engine.
 */
class Payslip extends Model
{
    use HasUuids;

    protected $table = 'hr_payslips';

    protected $fillable = [
        'company_id', 'payroll_run_id', 'payroll_period_id', 'employee_id', 'payslip_number',
        'basic_salary', 'bonus_total', 'commission_total', 'advance_total', 'deduction_total',
        'gross_salary', 'net_salary', 'currency', 'status', 'explanation',
        'calculated_at', 'approved_at',
    ];

    protected function casts(): array
    {
        return [
            'basic_salary' => 'decimal:2',
            'bonus_total' => 'decimal:2',
            'commission_total' => 'decimal:2',
            'advance_total' => 'decimal:2',
            'deduction_total' => 'decimal:2',
            'gross_salary' => 'decimal:2',
            'net_salary' => 'decimal:2',
            'explanation' => 'array',
            'calculated_at' => 'datetime',
            'approved_at' => 'datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function run(): BelongsTo
    {
        return $this->belongsTo(PayrollRun::class, 'payroll_run_id');
    }

    public function period(): BelongsTo
    {
        return $this->belongsTo(PayrollPeriod::class, 'payroll_period_id');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(PayslipLine::class, 'payslip_id')->orderBy('sequence');
    }

    /**
     * Re-derive the net from the stored components — a cheap invariant check that
     * the headline figures still agree with the formula that produced them.
     */
    public function recomputedNet(): float
    {
        return round(
            (float) $this->basic_salary
            + (float) $this->bonus_total
            + (float) $this->commission_total
            - (float) $this->advance_total
            - (float) $this->deduction_total,
            2
        );
    }
}
