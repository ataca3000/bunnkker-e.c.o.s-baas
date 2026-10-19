<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Fleet\Domain\Models\Inspection;
use Modules\Logistics\Fleet\Domain\Models\InspectionResult;

/**
 * @mixin Inspection
 */
class InspectionResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->uuid,
            'uuid' => $this->uuid,
            'fleet_unit_id' => $this->fleet_unit_id,
            'template_id' => $this->template_id,
            // Snapshotted at performance time so a historical inspection reads
            // exactly as it was performed.
            'template_version' => $this->template_version,

            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'is_immutable' => $this->isImmutable(),
            'allowed_transitions' => array_map(
                static fn ($s) => ['value' => $s->value, 'label' => $s->label()],
                $this->status->allowedTransitions(),
            ),

            'kind' => $this->kind->value,
            'kind_label' => $this->kind->label(),
            'is_mandatory_kind' => $this->kind->isMandatory(),

            'odometer_km' => $this->odometer_km !== null ? (float) $this->odometer_km : null,
            'has_critical_failure' => $this->has_critical_failure,
            'failed_item_count' => $this->failed_item_count,

            'performed_at' => $this->performed_at?->toIso8601String(),
            'performed_by' => $this->performed_by,
            'submitted_at' => $this->submitted_at?->toIso8601String(),
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
            'approved_by' => $this->approved_by,

            'notes' => $this->notes,
            'rejection_reason' => $this->rejection_reason,

            'results' => $this->whenLoaded('results', fn () => $this->results->map(
                static fn (InspectionResult $result) => [
                    'id' => $result->id,
                    'item_code' => $result->item_code,
                    'item_label' => $result->item_label,
                    'passed' => $result->passed,
                    'failure_severity' => $result->failure_severity->value,
                    'is_critical_failure' => $result->isCriticalFailure(),
                    'comment' => $result->comment,
                    'photos' => $result->photos ?? [],
                ]
            )->all()),

            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
