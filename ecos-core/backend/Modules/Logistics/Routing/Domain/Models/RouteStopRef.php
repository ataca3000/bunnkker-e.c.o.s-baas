<?php

declare(strict_types=1);

namespace Modules\Logistics\Routing\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Logistics\Distribution\Domain\Models\DeliveryStop;

/**
 * A stop's position in a plan.
 *
 * Points AT Distribution's stop — address, customer and order stay in V1 and
 * nothing is copied here (Directive 4/8).
 */
class RouteStopRef extends Model
{
    protected $table = 'routing_route_stop_refs';

    /** @var array<string, mixed> */
    protected $attributes = [
        'is_frozen' => false,
    ];

    protected $fillable = ['route_plan_id', 'stop_id', 'sequence', 'is_frozen'];

    protected function casts(): array
    {
        return [
            'sequence' => 'integer',
            'is_frozen' => 'boolean',
        ];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(RoutePlan::class, 'route_plan_id');
    }

    /** Read-only reference into Distribution. */
    public function stop(): BelongsTo
    {
        return $this->belongsTo(DeliveryStop::class, 'stop_id');
    }

    public function etaProjections(): HasMany
    {
        return $this->hasMany(EtaProjection::class, 'stop_ref_id')
            ->orderByDesc('refinement_level');
    }

    /** The best available projection — highest refinement level wins. */
    public function currentEta(): ?EtaProjection
    {
        return $this->etaProjections()->first();
    }
}
