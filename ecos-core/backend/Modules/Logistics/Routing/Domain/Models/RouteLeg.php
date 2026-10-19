<?php

declare(strict_types=1);

namespace Modules\Logistics\Routing\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One hop in a plan. A null from_stop_ref is the leg out of the origin depot. */
class RouteLeg extends Model
{
    protected $table = 'routing_route_legs';

    /** @var array<string, mixed> */
    protected $attributes = [
        'distance_km' => 0,
        'duration_minutes' => 0,
    ];

    protected $fillable = [
        'route_plan_id', 'sequence', 'from_stop_ref_id', 'to_stop_ref_id',
        'origin_lat', 'origin_lng', 'distance_km', 'duration_minutes',
    ];

    protected function casts(): array
    {
        return [
            'sequence' => 'integer',
            'distance_km' => 'decimal:2',
            'duration_minutes' => 'integer',
            'origin_lat' => 'decimal:7',
            'origin_lng' => 'decimal:7',
        ];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(RoutePlan::class, 'route_plan_id');
    }

    public function fromStopRef(): BelongsTo
    {
        return $this->belongsTo(RouteStopRef::class, 'from_stop_ref_id');
    }

    public function toStopRef(): BelongsTo
    {
        return $this->belongsTo(RouteStopRef::class, 'to_stop_ref_id');
    }

    public function isDepartureLeg(): bool
    {
        return $this->from_stop_ref_id === null;
    }
}
