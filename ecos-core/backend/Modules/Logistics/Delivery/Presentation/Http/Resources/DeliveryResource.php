<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Delivery\Domain\Models\Delivery;

/**
 * @mixin Delivery
 *
 * The UUID is the public identifier for a Delivery, matching the convention
 * established for Trip in TASK-LOG-004B.
 */
class DeliveryResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->uuid,
            'uuid' => $this->uuid,
            'company_id' => $this->company_id,
            'order_id' => $this->order_id,
            'order_number' => $this->whenLoaded('order', fn () => $this->order?->order_number),
            'order_customer_name' => $this->whenLoaded('order', fn () => $this->order?->customer_name),

            // Read-only pointer into Distribution — Delivery never writes here.
            'current_stop_id' => $this->current_stop_id,

            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'status_tone' => $this->status->tone(),
            'is_terminal' => $this->status->isTerminal(),
            'accepts_new_attempt' => $this->status->acceptsNewAttempt(),

            'attempt_count' => $this->attempt_count,
            'max_attempts' => $this->max_attempts,
            'remaining_attempts' => $this->remainingAttempts(),
            'retry_cutoff_date' => $this->retry_cutoff_date?->toDateString(),
            'within_retry_window' => $this->isWithinRetryWindow(),
            'can_retry' => $this->canRetry(),
            'retry_blockers' => $this->retryBlockers(),
            'requires_manual_review' => $this->requiresManualReview(),

            'promised_at' => $this->promised_at?->toIso8601String(),
            'sla_grace_minutes' => $this->sla_grace_minutes,
            'delivered_at' => $this->delivered_at?->toIso8601String(),
            'sla_breached' => $this->isSlaBreached(),
            'minutes_late' => $this->minutesLate(),
            'escalation_level' => $this->escalation_level,

            'requires_address_correction' => $this->requires_address_correction,
            'address_corrected_at' => $this->address_corrected_at?->toIso8601String(),

            'notes' => $this->notes,
            'created_by' => $this->created_by,

            // Honest booleans: whenLoaded() would collapse an empty loaded
            // relation to null, which the UI cannot distinguish from "unknown".
            'has_open_attempt' => $this->when(
                $this->relationLoaded('openAttempt'),
                fn () => $this->openAttempt !== null
            ),

            'attempts' => DeliveryAttemptResource::collection($this->whenLoaded('attempts')),
            'open_attempt' => new DeliveryAttemptResource($this->whenLoaded('openAttempt')),
            'latest_attempt' => new DeliveryAttemptResource($this->whenLoaded('latestAttempt')),
            'failures' => DeliveryFailureResource::collection($this->whenLoaded('failures')),
            'pods' => PodResource::collection($this->whenLoaded('pods')),
            'returns' => DeliveryReturnResource::collection($this->whenLoaded('returns')),
            'cod_record' => new CodRecordResource($this->whenLoaded('codRecord')),
            'tracking_events' => TrackingEventResource::collection($this->whenLoaded('trackingEvents')),

            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
