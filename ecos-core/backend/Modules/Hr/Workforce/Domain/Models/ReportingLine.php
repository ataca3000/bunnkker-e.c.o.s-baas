<?php

declare(strict_types=1);

namespace Modules\Hr\Workforce\Domain\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Hr\Workforce\Domain\Enums\ReportingLineType;

/** A dated who-reports-to-whom relationship. */
class ReportingLine extends Model
{
    use HasUuids;

    protected $table = 'hr_reporting_lines';

    protected $fillable = [
        'company_id', 'employee_id', 'manager_employee_id',
        'type', 'is_primary', 'effective_from', 'effective_to', 'note',
    ];

    protected function casts(): array
    {
        return [
            'type' => ReportingLineType::class,
            'is_primary' => 'boolean',
            'effective_from' => 'date',
            'effective_to' => 'date',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function manager(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'manager_employee_id');
    }

    /** Lines still in force — an open effective_to. */
    public function scopeCurrent(Builder $query): Builder
    {
        return $query->whereNull('effective_to');
    }

    public function scopePrimary(Builder $query): Builder
    {
        return $query->where('is_primary', true);
    }
}
