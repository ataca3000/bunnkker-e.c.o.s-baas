<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Hr\Workforce\Domain\Models\Employee;

/**
 * An immutable operational fact about what an employee did.
 *
 * The atom both the commission engine and the KPI engine are built from. Pushed
 * in by reference from Commerce, Shipping, Inventory, the CRM, Preparation and
 * Packing; append-only, so every derived figure is reproducible from history.
 */
class KpiFact extends Model
{
    use HasUuids;

    protected $table = 'hr_kpi_facts';

    protected $fillable = [
        'company_id', 'employee_id', 'department_id', 'source_module', 'metric_key',
        'value', 'quantity', 'dimension_key', 'dimension_value',
        'occurred_at', 'source_reference', 'idempotency_key', 'metadata',
        // Part 6 — traceability: what kind of document, and when HR received it.
        'source_document_type', 'source_document_number', 'imported_at',
    ];

    protected function casts(): array
    {
        return [
            'value' => 'decimal:4',
            'quantity' => 'decimal:4',
            'occurred_at' => 'datetime',
            'imported_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    /** Facts inside a window, inclusive. */
    public function scopeBetween(Builder $query, string $from, string $to): Builder
    {
        return $query->whereBetween('occurred_at', [$from.' 00:00:00', $to.' 23:59:59']);
    }

    /** Append-only: a recorded fact is never rewritten or removed. */
    protected static function booted(): void
    {
        static::updating(fn () => false);
        static::deleting(fn () => false);
    }
}
