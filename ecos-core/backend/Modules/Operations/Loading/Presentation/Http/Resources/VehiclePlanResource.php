<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Presentation\Http\Resources;

use BackedEnum;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class VehiclePlanResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'plan_number' => $this->plan_number,
            'status' => $this->status instanceof BackedEnum ? $this->status->value : $this->status,
            'version' => $this->version,
            'operational_date' => $this->operational_date?->toDateString(),
            'slots_count' => $this->slots_count,
            'orders_count' => $this->orders_count,
            'total_weight_kg' => (float) $this->total_weight_kg,
            'total_volume_m3' => (float) $this->total_volume_m3,
            'distribution_policy' => $this->distribution_policy instanceof BackedEnum ? $this->distribution_policy->value : $this->distribution_policy,
            'proposed_at' => $this->proposed_at?->toIso8601String(),
            'approved_at' => $this->approved_at?->toIso8601String(),
            'replan_trigger' => $this->replan_trigger,
            'created_at' => $this->created_at?->toIso8601String(),
            'slots' => $this->whenLoaded('slots', fn () => VehiclePlanSlotResource::collection($this->slots)),
        ];
    }
}
