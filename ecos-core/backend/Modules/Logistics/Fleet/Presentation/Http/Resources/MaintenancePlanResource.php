<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Fleet\Domain\Models\MaintenancePlan;
use Modules\Logistics\Fleet\Domain\Models\MaintenanceScheduleRule;

/**
 * @mixin MaintenancePlan
 */
class MaintenancePlanResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $currentKm = $this->relationLoaded('unit') && $this->unit?->current_odometer_km !== null
            ? (float) $this->unit->current_odometer_km
            : null;

        return [
            'id' => $this->uuid,
            'uuid' => $this->uuid,
            'fleet_unit_id' => $this->fleet_unit_id,
            'maintenance_type' => $this->maintenance_type,
            'name' => $this->name,
            'description' => $this->description,

            'next_due_km' => $this->next_due_km !== null ? (float) $this->next_due_km : null,
            'next_due_date' => $this->next_due_date?->toDateString(),
            'last_performed_km' => $this->last_performed_km !== null
                ? (float) $this->last_performed_km
                : null,
            'last_performed_date' => $this->last_performed_date?->toDateString(),

            'grace_days' => $this->grace_days,
            'grace_km' => $this->grace_km,

            'is_due' => $this->isDue($currentKm),
            'is_overdue' => $this->isOverdue($currentKm),
            'days_until_due' => $this->daysUntilDue(),
            'km_until_due' => $this->kmUntilDue($currentKm),

            'is_active' => $this->is_active,
            'is_open' => $this->active_flag !== null,

            'rules' => $this->whenLoaded('rules', fn () => $this->rules->map(
                static fn (MaintenanceScheduleRule $rule) => [
                    'id' => $rule->id,
                    'trigger' => $rule->trigger->value,
                    'trigger_label' => $rule->trigger->label(),
                    'interval_value' => (float) $rule->interval_value,
                    'unit' => $rule->unitLabel(),
                    'is_active' => $rule->is_active,
                ]
            )->all()),

            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
