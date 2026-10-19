<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Presentation\Http\Resources;

use BackedEnum;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class RoutePlanResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'route_number' => $this->route_number,
            'status' => $this->status instanceof BackedEnum ? $this->status->value : $this->status,
            'version' => $this->version,
            'stops_count' => $this->stops_count,
            'total_distance_km' => (float) $this->total_distance_km,
            'estimated_duration_min' => (int) $this->estimated_duration_min,
            'optimization_score' => $this->optimization_score,
            'planned_departure_at' => $this->planned_departure_at?->toIso8601String(),
            'actual_departure_at' => $this->actual_departure_at?->toIso8601String(),
            'stops' => $this->whenLoaded('stops', fn () => $this->stops->map(fn ($stop) => [
                'id' => $stop->id,
                'sequence' => $stop->sequence,
                'stop_type' => $stop->stop_type instanceof BackedEnum ? $stop->stop_type->value : $stop->stop_type,
                'address_snapshot' => $stop->address_snapshot,
                'orders_count' => $stop->orders_count,
                'estimated_arrival_at' => $stop->estimated_arrival_at?->toIso8601String(),
                'actual_arrival_at' => $stop->actual_arrival_at?->toIso8601String(),
            ])->values()->all()),
        ];
    }
}
