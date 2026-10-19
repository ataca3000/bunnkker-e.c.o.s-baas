<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Hr\Recruitment\Domain\Enums\LifecycleEventType;
use Modules\Hr\Workforce\Domain\Models\Employee;

/**
 * One entry in someone's employment history. Append-only.
 *
 * The employee record says where someone IS; this says how they got there. Only
 * a log can answer "what did this person's job look like two years ago", because
 * the employee row only ever holds the latest values.
 */
class EmployeeLifecycleEvent extends Model
{
    use HasUuids;

    protected $table = 'hr_employee_lifecycle_events';

    protected $fillable = [
        'company_id', 'employee_id', 'event_type', 'effective_date', 'reason', 'notes',
        'from_values', 'to_values', 'source_module', 'source_reference', 'actor_id',
    ];

    protected function casts(): array
    {
        return [
            'event_type' => LifecycleEventType::class,
            'effective_date' => 'date',
            'from_values' => 'array',
            'to_values' => 'array',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    /** History is a record, not a draft. */
    protected static function booted(): void
    {
        static::updating(fn () => false);
        static::deleting(fn () => false);
    }
}
