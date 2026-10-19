<?php

declare(strict_types=1);

namespace Modules\Logistics\Routing\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Routing\Domain\Models\RouteLeg;
use Modules\Logistics\Routing\Domain\Models\RoutePlan;
use Modules\Logistics\Routing\Domain\Models\RouteStopRef;

/**
 * @mixin RoutePlan
 */
class RoutePlanResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->uuid,
            'uuid' => $this->uuid,
            'trip_id' => $this->trip_id,

            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'is_current' => $this->isCurrent(),
            'is_superseded' => $this->isSuperseded(),
            'superseded_by_plan_id' => $this->superseded_by_plan_id,
            'supersede_reason' => $this->supersede_reason,

            'strategy' => $this->strategy,
            'strategy_version' => $this->strategy_version,

            'total_distance_km' => $this->total_distance_km !== null
                ? (float) $this->total_distance_km
                : null,
            'total_duration_minutes' => $this->total_duration_minutes,
            'stop_count' => $this->stop_count,
            'average_km_per_stop' => $this->averageKmPerStop(),
            // How much to trust the numbers: the share of stops that had
            // coordinates. Surfacing uncertainty beats false precision.
            'confidence' => $this->confidence !== null ? (float) $this->confidence : null,

            'planned_at' => $this->planned_at?->toIso8601String(),
            'activated_at' => $this->activated_at?->toIso8601String(),
            'completed_at' => $this->completed_at?->toIso8601String(),

            'stops' => $this->whenLoaded('stopRefs', fn () => $this->stopRefs->map(
                static function (RouteStopRef $ref) {
                    $eta = $ref->relationLoaded('etaProjections') ? $ref->etaProjections->first() : null;

                    return [
                        'stop_id' => $ref->stop_id,
                        'sequence' => $ref->sequence,
                        // A stop already attempted keeps its position — a
                        // reroute never rewrites history.
                        'is_frozen' => $ref->is_frozen,
                        'eta' => $eta?->projected_arrival_at?->toIso8601String(),
                        'eta_level' => $eta?->refinement_level,
                        'eta_level_label' => $eta?->levelLabel(),
                        'breach_predicted' => (bool) $eta?->breach_predicted,
                        'minutes_late' => $eta?->minutes_late,
                    ];
                }
            )->all()),

            'legs' => $this->whenLoaded('legs', fn () => $this->legs->map(
                static fn (RouteLeg $leg) => [
                    'sequence' => $leg->sequence,
                    'from_stop_ref_id' => $leg->from_stop_ref_id,
                    'to_stop_ref_id' => $leg->to_stop_ref_id,
                    'is_departure_leg' => $leg->isDepartureLeg(),
                    'distance_km' => (float) $leg->distance_km,
                    'duration_minutes' => $leg->duration_minutes,
                ]
            )->all()),

            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
