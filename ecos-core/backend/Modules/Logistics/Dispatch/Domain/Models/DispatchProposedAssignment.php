<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use Modules\Logistics\Dispatch\Domain\Enums\AssignmentStatus;
use Modules\Logistics\Distribution\Domain\Models\Trip;
use Modules\Logistics\Drivers\Domain\Models\Driver;
use Modules\Logistics\Vehicles\Domain\Models\Vehicle;

/**
 * trip ⇄ vehicle ⇄ driver, with a score and a reason.
 *
 * ┌─ DIRECTIVE 4/8 — NO DUPLICATE MASTER DATA ──────────────────────────────┐
 * │ Vehicle, driver and trip are referenced BY ID. No plate, no driver name, │
 * │ no capacity is stored here — Dispatch owns the SCORE and the REASON,     │
 * │ never the master data.                                                   │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class DispatchProposedAssignment extends Model
{
    protected $table = 'dispatch_proposed_assignments';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => AssignmentStatus::Proposed->value,
        'score' => 0,
    ];

    protected $fillable = [
        'uuid', 'dispatch_proposal_id', 'trip_id', 'vehicle_id', 'driver_id',
        'status', 'score', 'score_breakdown', 'fitness_level',
    ];

    protected function casts(): array
    {
        return [
            'status' => AssignmentStatus::class,
            'score' => 'integer',
            'score_breakdown' => 'array',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $assignment): void {
            if ($assignment->uuid === null) {
                $assignment->uuid = (string) Str::uuid();
            }
        });
    }

    public function proposal(): BelongsTo
    {
        return $this->belongsTo(DispatchProposal::class, 'dispatch_proposal_id');
    }

    // ── V1 aggregates, read-only from Dispatch ────────────────────────────────

    public function trip(): BelongsTo
    {
        return $this->belongsTo(Trip::class, 'trip_id');
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class, 'vehicle_id');
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(Driver::class, 'driver_id');
    }

    public function blockers(): HasMany
    {
        return $this->hasMany(DispatchAssignmentBlocker::class, 'assignment_id');
    }

    public function isReleasable(): bool
    {
        return $this->status->isReleasable();
    }

    public function hasHardBlocker(): bool
    {
        return $this->blockers()->where('is_hard', true)->exists();
    }

    /**
     * Ordered, human-readable reasons — the LOG-005 retryBlockers() contract
     * generalised. A board that says "blocked" without saying why is not
     * acceptable, so the reasons travel with the assignment.
     *
     * @return list<string>
     */
    public function blockerReasons(): array
    {
        if (! $this->relationLoaded('blockers')) {
            $this->load('blockers');
        }

        return $this->blockers
            ->sortByDesc('is_hard')
            ->pluck('reason')
            ->values()
            ->all();
    }
}
