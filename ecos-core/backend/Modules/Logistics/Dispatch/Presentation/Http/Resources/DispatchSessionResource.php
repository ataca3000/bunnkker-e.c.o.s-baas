<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Dispatch\Domain\Models\DispatchSession;

/**
 * @mixin DispatchSession
 */
class DispatchSessionResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->uuid,
            'uuid' => $this->uuid,
            'company_id' => $this->company_id,
            'dispatch_board_id' => $this->dispatch_board_id,

            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'status_tone' => $this->status->tone(),
            'is_active' => $this->isActive(),
            'allowed_transitions' => array_map(
                static fn ($s) => ['value' => $s->value, 'label' => $s->label()],
                $this->status->allowedTransitions(),
            ),

            'mode' => $this->mode,
            'is_automatic' => $this->isAutomatic(),

            'operator_id' => $this->operator_id,
            'operator_name' => $this->operator_name,

            'started_at' => $this->started_at?->toIso8601String(),
            'ended_at' => $this->ended_at?->toIso8601String(),
            'duration_minutes' => $this->durationMinutes(),
            // Null until a session has run long enough to mean anything.
            'throughput_per_hour' => $this->throughputPerHour(),
            'is_idle' => $this->isIdle(),

            'assigned_count' => $this->assigned_count,
            'released_count' => $this->released_count,
            'conflict_count' => $this->conflict_count,

            'held_lock_count' => $this->when(
                $this->relationLoaded('locks'),
                fn () => $this->locks->where('status.value', 'held')->count(),
            ),

            'board' => $this->whenLoaded('board', fn () => $this->board === null ? null : [
                'id' => $this->board->uuid,
                'board_date' => $this->board->board_date?->toDateString(),
                'status' => $this->board->status->value,
            ]),

            'notes' => $this->notes,
            'close_reason' => $this->close_reason,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
