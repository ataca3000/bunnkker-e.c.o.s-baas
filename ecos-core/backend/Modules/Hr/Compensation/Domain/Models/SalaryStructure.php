<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Hr\Workforce\Domain\Models\Employee;

/** An employee's basic salary, dated so a raise never rewrites history. */
class SalaryStructure extends Model
{
    use HasUuids;

    protected $table = 'hr_salary_structures';

    protected $fillable = [
        'company_id', 'employee_id', 'basic_salary', 'currency',
        'pay_frequency', 'effective_from', 'effective_to', 'notes', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'basic_salary' => 'decimal:2',
            'effective_from' => 'date',
            'effective_to' => 'date',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    /** Structures in force on a date — what a recalculation of that period must use. */
    public function scopeInForceOn(Builder $query, string $date): Builder
    {
        return $query->where('effective_from', '<=', $date)
            ->where(fn ($q) => $q->whereNull('effective_to')->orWhere('effective_to', '>=', $date));
    }

    public function scopeCurrent(Builder $query): Builder
    {
        return $query->whereNull('effective_to');
    }
}
