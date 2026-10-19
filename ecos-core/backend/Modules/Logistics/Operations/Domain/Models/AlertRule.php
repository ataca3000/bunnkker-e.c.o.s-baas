<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use Modules\Logistics\Operations\Domain\Enums\ExceptionCategory;
use Modules\Logistics\Operations\Domain\Enums\ExceptionSeverity;
use Modules\Logistics\Operations\Domain\Enums\ExceptionSource;

/**
 * Which exceptions become alerts, and how impatiently.
 *
 * ┌─ CONFIGURATION, NOT A SECOND LIFECYCLE ─────────────────────────────────┐
 * │ There is no alerts table. An alert IS an exception that a rule matched.  │
 * │ Two tables would mean two records of one problem, drifting apart the     │
 * │ moment somebody resolved one of them.                                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Every criterion is nullable and null means "any", so a rule can be as broad as
 * "anything critical" or as narrow as one exception type from one module.
 */
class AlertRule extends Model
{
    protected $table = 'ops_alert_rules';

    /** @var array<string, mixed> */
    protected $attributes = [
        'min_severity' => ExceptionSeverity::Warning->value,
        'is_active' => true,
        'suppress' => false,
    ];

    protected $fillable = [
        'uuid', 'company_id', 'name',
        'source', 'category', 'exception_type', 'min_severity',
        'is_active', 'escalate_after_minutes', 'escalate_to_role',
        'suppress', 'suppress_reason', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'source' => ExceptionSource::class,
            'category' => ExceptionCategory::class,
            'min_severity' => ExceptionSeverity::class,
            'is_active' => 'boolean',
            'suppress' => 'boolean',
            'escalate_after_minutes' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $rule): void {
            if ($rule->uuid === null) {
                $rule->uuid = (string) Str::uuid();
            }
        });
    }

    /** Does this rule apply to that exception? Null criteria match anything. */
    public function matches(OperationalException $exception): bool
    {
        if (! $this->is_active) {
            return false;
        }

        if ($this->source !== null && $this->source !== $exception->source) {
            return false;
        }

        if ($this->category !== null && $this->category !== $exception->category) {
            return false;
        }

        if ($this->exception_type !== null && $this->exception_type !== $exception->exception_type) {
            return false;
        }

        return $exception->severity->atLeast($this->min_severity);
    }

    /**
     * How long a matching exception may sit unacknowledged.
     *
     * The rule overrides the severity default, so an operation can be more
     * impatient about one class of problem without changing the whole scale.
     */
    public function escalationMinutesFor(OperationalException $exception): ?int
    {
        return $this->escalate_after_minutes ?? $exception->severity->defaultEscalationMinutes();
    }
}
