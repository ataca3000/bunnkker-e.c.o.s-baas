<?php

declare(strict_types=1);

namespace Modules\Hr\Performance\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Hr\Performance\Domain\Enums\IncidentCategory;
use Modules\Hr\Workforce\Domain\Models\Employee;

/** An operational event involving an employee, pointing at its evidence by reference. */
class EmployeeIncident extends Model
{
    use HasUuids;

    protected $table = 'hr_employee_incidents';

    protected $fillable = [
        'company_id', 'employee_id', 'occurred_on', 'category', 'severity', 'description',
        'related_module', 'related_reference', 'related_document_type',
        'amount', 'deduction_id', 'bonus_id', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'category' => IncidentCategory::class,
            'occurred_on' => 'date',
            'amount' => 'decimal:2',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    /** Has this incident already been turned into money, either way? */
    public function hasFinancialOutcome(): bool
    {
        return $this->deduction_id !== null || $this->bonus_id !== null;
    }
}
