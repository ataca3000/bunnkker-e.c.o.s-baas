<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Modules\Logistics\Dispatch\Domain\Models\DispatchConflict;
use Modules\Logistics\Operations\Domain\Enums\ExceptionCategory;
use Modules\Logistics\Operations\Domain\Enums\ExceptionSeverity;
use Modules\Logistics\Operations\Domain\Enums\ExceptionSource;
use Modules\Logistics\Operations\Domain\Enums\ExceptionStatus;

/**
 * One problem, however many times it was observed.
 *
 * The dedup key is the whole design. Four hundred identical carrier failures are
 * one exception seen four hundred times, and an operator needs the count — not
 * four hundred rows to close one at a time.
 *
 * Named OperationalException, not Exception, because `Exception` is PHP's.
 */
class OperationalException extends Model
{
    public const RESOLUTION_FIXED = 'fixed';

    public const RESOLUTION_NOT_A_PROBLEM = 'not_a_problem';

    public const RESOLUTION_HANDLED_ELSEWHERE = 'handled_elsewhere';

    public const RESOLUTION_ACCEPTED = 'accepted';

    protected $table = 'ops_exceptions';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => ExceptionStatus::Open->value,
        'severity' => ExceptionSeverity::Warning->value,
        'occurrence_count' => 1,
        'escalation_level' => 0,
    ];

    protected $fillable = [
        'uuid', 'company_id',
        'source', 'category', 'exception_type', 'severity', 'status',
        'title', 'description', 'context',
        'subject_type', 'subject_id', 'source_conflict_id',
        'dedup_key', 'active_flag',
        'first_seen_at', 'last_seen_at', 'occurrence_count',
        'acknowledged_at', 'acknowledged_by', 'acknowledged_by_name',
        'resolved_at', 'resolved_by', 'resolved_by_name', 'resolution', 'resolution_reason',
        'escalation_level',
    ];

    protected function casts(): array
    {
        return [
            'source' => ExceptionSource::class,
            'category' => ExceptionCategory::class,
            'severity' => ExceptionSeverity::class,
            'status' => ExceptionStatus::class,
            'context' => 'array',
            'occurrence_count' => 'integer',
            'escalation_level' => 'integer',
            'first_seen_at' => 'datetime',
            'last_seen_at' => 'datetime',
            'acknowledged_at' => 'datetime',
            'resolved_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $exception): void {
            if ($exception->uuid === null) {
                $exception->uuid = (string) Str::uuid();
            }

            $now = now();
            $exception->first_seen_at ??= $now;
            $exception->last_seen_at ??= $now;
        });
    }

    public function escalations(): HasMany
    {
        return $this->hasMany(ExceptionEscalation::class, 'exception_id');
    }

    public function notes(): HasMany
    {
        return $this->hasMany(ExceptionNote::class, 'exception_id');
    }

    /**
     * The Phase 3 conflict this was raised from, if any.
     *
     * A pointer, not a copy: the conflict remains Dispatch's, and resolving this
     * exception does not resolve it.
     */
    public function sourceConflict(): BelongsTo
    {
        return $this->belongsTo(DispatchConflict::class, 'source_conflict_id');
    }

    public function isOutstanding(): bool
    {
        return $this->status->isOutstanding();
    }

    public function needsAttention(): bool
    {
        return $this->status->needsAttention();
    }

    /** Whether Operations may close this itself, or must defer to the owner. */
    public function isSelfOwned(): bool
    {
        return $this->source->isSelfOwned();
    }

    public function ageMinutes(?Carbon $at = null): int
    {
        return (int) $this->first_seen_at->diffInMinutes(
            $this->resolved_at ?? $at ?? Carbon::now()
        );
    }

    /** How long it has sat unlooked-at. Null once someone has acknowledged it. */
    public function unacknowledgedMinutes(?Carbon $at = null): ?int
    {
        if ($this->acknowledged_at !== null) {
            return null;
        }

        return (int) $this->first_seen_at->diffInMinutes($at ?? Carbon::now());
    }

    /**
     * Whether it has waited past its severity's patience.
     *
     * Info never qualifies: escalating trivia is how an escalation channel
     * becomes noise nobody reads.
     */
    public function isOverdueForEscalation(?Carbon $at = null): bool
    {
        $limit = $this->severity->defaultEscalationMinutes();

        if ($limit === null || ! $this->needsAttention()) {
            return false;
        }

        $waiting = $this->unacknowledgedMinutes($at);

        return $waiting !== null && $waiting >= $limit;
    }
}
