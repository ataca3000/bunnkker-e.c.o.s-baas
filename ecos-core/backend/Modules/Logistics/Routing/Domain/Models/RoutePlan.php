<?php

declare(strict_types=1);

namespace Modules\Logistics\Routing\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use Modules\Logistics\Distribution\Domain\Models\Trip;
use Modules\Logistics\Routing\Domain\Enums\RoutePlanStatus;

/**
 * A plan for one trip.
 *
 * Plans SUPERSEDE, never update: a reroute writes a new plan and the old one
 * stays readable, which is what makes "why did we drive that way?" answerable
 * weeks later.
 */
class RoutePlan extends Model
{
    protected $table = 'routing_route_plans';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => RoutePlanStatus::Draft->value,
        'stop_count' => 0,
    ];

    protected $fillable = [
        'uuid', 'company_id', 'trip_id', 'status', 'strategy', 'strategy_version',
        'total_distance_km', 'total_duration_minutes', 'stop_count', 'confidence',
        'superseded_by_plan_id', 'supersede_reason',
        'planned_at', 'activated_at', 'completed_at', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'status' => RoutePlanStatus::class,
            'total_distance_km' => 'decimal:2',
            'total_duration_minutes' => 'integer',
            'stop_count' => 'integer',
            'confidence' => 'decimal:3',
            'planned_at' => 'datetime',
            'activated_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $plan): void {
            if ($plan->uuid === null) {
                $plan->uuid = (string) Str::uuid();
            }
        });
    }

    /** Distribution owns the trip. Read-only from Routing. */
    public function trip(): BelongsTo
    {
        return $this->belongsTo(Trip::class, 'trip_id');
    }

    public function stopRefs(): HasMany
    {
        return $this->hasMany(RouteStopRef::class, 'route_plan_id')->orderBy('sequence');
    }

    public function legs(): HasMany
    {
        return $this->hasMany(RouteLeg::class, 'route_plan_id')->orderBy('sequence');
    }

    public function runs(): HasMany
    {
        return $this->hasMany(OptimizationRun::class, 'route_plan_id')->latest('id');
    }

    public function supersededBy(): BelongsTo
    {
        return $this->belongsTo(self::class, 'superseded_by_plan_id');
    }

    public function isSuperseded(): bool
    {
        return $this->superseded_by_plan_id !== null;
    }

    public function isCurrent(): bool
    {
        return ! $this->isSuperseded() && $this->status->isCurrent();
    }

    /**
     * A reroute may only supersede with a plan whose already-attempted stops
     * hold identical positions. This is the rule that stops a reroute from
     * rewriting history, and it is enforced rather than assumed.
     */
    public function preservesFrozenOrder(self $replacement): bool
    {
        $mine = $this->stopRefs()->where('is_frozen', true)->pluck('stop_id', 'sequence')->all();

        if ($mine === []) {
            return true;
        }

        $theirs = $replacement->stopRefs()->where('is_frozen', true)->pluck('stop_id', 'sequence')->all();

        return $mine === $theirs;
    }

    public function averageKmPerStop(): ?float
    {
        if ($this->stop_count <= 0 || $this->total_distance_km === null) {
            return null;
        }

        return round((float) $this->total_distance_km / $this->stop_count, 2);
    }
}
