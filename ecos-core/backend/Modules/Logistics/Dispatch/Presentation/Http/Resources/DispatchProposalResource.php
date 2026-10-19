<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Dispatch\Domain\Models\DispatchProposal;
use Modules\Logistics\Dispatch\Domain\Models\DispatchProposedAssignment;

/**
 * @mixin DispatchProposal
 *
 * Vehicle and driver appear here by ID and by the few display fields the board
 * needs, read through the relation. Dispatch stores none of them (Directive 4).
 */
class DispatchProposalResource extends JsonResource
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
            'is_decided' => $this->isDecided(),

            'assignment_count' => $this->assignment_count,
            'blocked_count' => $this->blocked_count,

            'decided_at' => $this->decided_at?->toIso8601String(),
            'decided_by' => $this->decided_by,
            'decision_reason' => $this->decision_reason,

            'assignments' => $this->whenLoaded('assignments', fn () => $this->assignments->map(
                static fn (DispatchProposedAssignment $assignment) => [
                    'id' => $assignment->uuid,
                    'status' => $assignment->status->value,
                    'status_label' => $assignment->status->label(),
                    'status_tone' => $assignment->status->tone(),
                    'is_releasable' => $assignment->isReleasable(),

                    'trip_id' => $assignment->trip?->uuid,
                    'trip_number' => $assignment->trip?->trip_number,
                    'vehicle_id' => $assignment->vehicle_id,
                    'vehicle_plate' => $assignment->vehicle?->plate_number,
                    'driver_id' => $assignment->driver_id,
                    'driver_name' => $assignment->driver?->full_name,

                    'score' => $assignment->score,
                    'score_breakdown' => $assignment->score_breakdown,
                    'fitness_level' => $assignment->fitness_level,

                    // Ordered, human-readable — a board that says "blocked"
                    // without saying why is not acceptable.
                    'blockers' => $assignment->blockerReasons(),
                ]
            )->all()),

            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
