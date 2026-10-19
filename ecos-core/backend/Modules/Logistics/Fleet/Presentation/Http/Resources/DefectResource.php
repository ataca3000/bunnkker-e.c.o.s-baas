<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Fleet\Domain\Models\Defect;

/**
 * @mixin Defect
 */
class DefectResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->uuid,
            'uuid' => $this->uuid,
            'fleet_unit_id' => $this->fleet_unit_id,
            'inspection_id' => $this->inspection_id,
            'work_order_id' => $this->work_order_id,

            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'is_outstanding' => $this->isOutstanding(),
            'allowed_transitions' => array_map(
                static fn ($s) => ['value' => $s->value, 'label' => $s->label()],
                $this->status->allowedTransitions(),
            ),

            'severity' => $this->severity->value,
            'severity_label' => $this->severity->label(),
            'severity_tone' => $this->severity->tone(),
            'blocks_fitness' => $this->blocksFitness(),
            'requires_override_to_dismiss' => $this->requiresOverrideToDismiss(),

            'title' => $this->title,
            'description' => $this->description,
            'photos' => $this->photos ?? [],

            'reported_at' => $this->reported_at?->toIso8601String(),
            'reported_by' => $this->reported_by,
            'acknowledged_at' => $this->acknowledged_at?->toIso8601String(),
            'resolved_at' => $this->resolved_at?->toIso8601String(),
            'resolved_by' => $this->resolved_by,
            'age_days' => $this->ageInDays(),

            'dismissal_reason' => $this->dismissal_reason,
            'dismissed_by' => $this->dismissed_by,

            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
