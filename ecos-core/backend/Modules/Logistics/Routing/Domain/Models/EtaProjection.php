<?php

declare(strict_types=1);

namespace Modules\Logistics\Routing\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Projected arrival at a stop.
 *
 * ┌─ REFINEMENT LADDER (D3 — TELEMETRY DEFERRED) ───────────────────────────┐
 * │ L0 planned            — leg durations from the strategy                  │
 * │ L1 departure-adjusted — actual departure from Distribution               │
 * │ L2 progress-adjusted  — completed stops and real dwell from Delivery     │
 * │ L3 position-adjusted  — live GPS  *** Phase 8, NOT implemented ***       │
 * │                                                                          │
 * │ L0–L2 use nothing but V1 facts. ETA quality degrades without telemetry;  │
 * │ ETA AVAILABILITY does not. That is Directive 5 expressed as a ladder     │
 * │ rather than a switch.                                                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class EtaProjection extends Model
{
    public const LEVEL_PLANNED = 0;

    public const LEVEL_DEPARTURE_ADJUSTED = 1;

    public const LEVEL_PROGRESS_ADJUSTED = 2;

    /** Reserved for Phase 8. Nothing in Phase 2 produces this level. */
    public const LEVEL_POSITION_ADJUSTED = 3;

    protected $table = 'routing_eta_projections';

    /** @var array<string, mixed> */
    protected $attributes = [
        'refinement_level' => self::LEVEL_PLANNED,
        'service_minutes' => 0,
        'breach_predicted' => false,
    ];

    protected $fillable = [
        'stop_ref_id', 'refinement_level', 'projected_arrival_at',
        'service_minutes', 'breach_predicted', 'minutes_late',
    ];

    protected function casts(): array
    {
        return [
            'refinement_level' => 'integer',
            'projected_arrival_at' => 'datetime',
            'service_minutes' => 'integer',
            'breach_predicted' => 'boolean',
            'minutes_late' => 'integer',
        ];
    }

    public function stopRef(): BelongsTo
    {
        return $this->belongsTo(RouteStopRef::class, 'stop_ref_id');
    }

    public function levelLabel(): string
    {
        return match ($this->refinement_level) {
            self::LEVEL_PLANNED => 'Planned',
            self::LEVEL_DEPARTURE_ADJUSTED => 'Departure adjusted',
            self::LEVEL_PROGRESS_ADJUSTED => 'Progress adjusted',
            self::LEVEL_POSITION_ADJUSTED => 'Position adjusted',
            default => 'Unknown',
        };
    }

    /** Whether this projection used any telemetry-derived input. Always false in Phase 2. */
    public function usesTelemetry(): bool
    {
        return $this->refinement_level >= self::LEVEL_POSITION_ADJUSTED;
    }
}
