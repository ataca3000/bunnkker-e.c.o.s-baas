<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Dispatch\Domain\Models\DispatchQueueItem;

/**
 * @mixin DispatchQueueItem
 *
 * Trip identity is read through the relation. Dispatch stores no trip attribute
 * (Directive 12).
 */
class QueueItemResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->uuid,
            'uuid' => $this->uuid,
            'dispatch_board_id' => $this->dispatch_board_id,

            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'status_tone' => $this->status->tone(),
            'needs_action' => $this->needsAction(),
            'allowed_transitions' => array_map(
                static fn ($s) => ['value' => $s->value, 'label' => $s->label()],
                $this->status->allowedTransitions(),
            ),

            'priority' => $this->priority->value,
            'priority_label' => $this->priority->label(),
            'priority_tone' => $this->priority->tone(),
            // Ordering must be explainable, or dispatchers work around it.
            'priority_reason' => $this->priority_reason,
            'rank' => $this->rank,

            'trip_id' => $this->trip?->uuid,
            'trip_number' => $this->trip?->trip_number,
            'trip_capacity' => $this->trip?->capacity,

            'queued_at' => $this->queued_at?->toIso8601String(),
            'waiting_minutes' => $this->waitingMinutes(),
            'claimed_at' => $this->claimed_at?->toIso8601String(),
            'claimed_by_session_id' => $this->claimedBy?->uuid,
            'claimed_by' => $this->claimedBy?->operator_name,

            'attempt_count' => $this->attempt_count,
            // Repeated failure needs a human, not another retry.
            'is_stuck' => $this->isStuck(),
            'last_failure_reason' => $this->last_failure_reason,

            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
