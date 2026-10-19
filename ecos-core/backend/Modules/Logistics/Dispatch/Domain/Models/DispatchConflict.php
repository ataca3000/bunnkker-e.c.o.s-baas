<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Modules\Logistics\Dispatch\Domain\Enums\ConflictStatus;
use Modules\Logistics\Dispatch\Domain\Enums\ConflictType;

/**
 * A detected clash.
 *
 * The description is always human-readable and, where the fact belongs to
 * another module, quotes that module verbatim. A conflict a dispatcher cannot
 * read is one they will override without understanding.
 */
class DispatchConflict extends Model
{
    public const RESOLUTION_REASSIGNED = 'reassigned';

    public const RESOLUTION_RESOURCE_FREED = 'resource_freed';

    public const RESOLUTION_CONDITION_CLEARED = 'condition_cleared';

    public const RESOLUTION_OVERRIDDEN = 'overridden';

    public const RESOLUTION_TRIP_DEFERRED = 'trip_deferred';

    protected $table = 'dispatch_conflicts';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => ConflictStatus::Open->value,
        'severity' => 'blocking',
    ];

    protected $fillable = [
        'uuid', 'company_id', 'dispatch_session_id', 'assignment_id', 'allocation_id',
        'conflict_type', 'severity', 'status',
        'resource_type', 'resource_id', 'conflicting_allocation_id',
        'description', 'context',
        'detected_at', 'resolved_at', 'resolution', 'resolution_reason', 'resolved_by',
    ];

    protected function casts(): array
    {
        return [
            'conflict_type' => ConflictType::class,
            'status' => ConflictStatus::class,
            'context' => 'array',
            'detected_at' => 'datetime',
            'resolved_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $conflict): void {
            if ($conflict->uuid === null) {
                $conflict->uuid = (string) Str::uuid();
            }

            if ($conflict->detected_at === null) {
                $conflict->detected_at = now();
            }

            // Severity comes from the TYPE, so the same clash is always
            // weighted the same way whichever path found it.
            if ($conflict->conflict_type instanceof ConflictType) {
                $conflict->severity = $conflict->conflict_type->severity();
            }
        });
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(DispatchSession::class, 'dispatch_session_id');
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(DispatchProposedAssignment::class, 'assignment_id');
    }

    public function allocation(): BelongsTo
    {
        return $this->belongsTo(ResourceAllocation::class, 'allocation_id');
    }

    public function isOutstanding(): bool
    {
        return $this->status->isOutstanding();
    }

    /** Only a blocking, outstanding conflict actually stops a release. */
    public function blocksRelease(): bool
    {
        return $this->isOutstanding() && $this->conflict_type->isBlocking();
    }

    /** Which module owns the underlying fact — where to go and fix it. */
    public function authority(): string
    {
        return $this->conflict_type->authority();
    }

    public function ageMinutes(?Carbon $at = null): int
    {
        return (int) $this->detected_at->diffInMinutes($this->resolved_at ?? $at ?? Carbon::now());
    }
}
