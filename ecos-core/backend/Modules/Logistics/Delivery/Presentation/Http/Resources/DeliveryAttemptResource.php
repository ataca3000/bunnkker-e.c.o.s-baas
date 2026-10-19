<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Delivery\Domain\Models\DeliveryAttempt;

/**
 * @mixin DeliveryAttempt
 */
class DeliveryAttemptResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->uuid,
            'uuid' => $this->uuid,
            'attempt_no' => $this->attempt_no,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'is_open' => $this->isOpen(),
            'allowed_transitions' => array_map(
                static fn ($s) => ['value' => $s->value, 'label' => $s->label()],
                $this->status->allowedTransitions(),
            ),

            // Read-only references into Distribution.
            'stop_id' => $this->stop_id,
            'trip_id' => $this->trip_id,

            'en_route_at' => $this->en_route_at?->toIso8601String(),
            'arrived_at' => $this->arrived_at?->toIso8601String(),
            'started_at' => $this->started_at?->toIso8601String(),
            'closed_at' => $this->closed_at?->toIso8601String(),
            'dwell_minutes' => $this->dwellMinutes(),

            'gps_lat' => $this->gps_lat !== null ? (float) $this->gps_lat : null,
            'gps_lng' => $this->gps_lng !== null ? (float) $this->gps_lng : null,
            'gps_accuracy_m' => $this->gps_accuracy_m,

            'recipient_name' => $this->recipient_name,
            'recipient_relationship' => $this->recipient_relationship,
            'notes' => $this->notes,

            'failure' => new DeliveryFailureResource($this->whenLoaded('failure')),
            'pod' => new PodResource($this->whenLoaded('pod')),

            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
