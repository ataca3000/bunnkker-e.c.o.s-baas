<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Dispatch\Domain\Models\DispatchBoard;

/**
 * @mixin DispatchBoard
 */
class DispatchBoardResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->uuid,
            'uuid' => $this->uuid,
            'company_id' => $this->company_id,
            'board_date' => $this->board_date?->toDateString(),

            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'status_tone' => $this->status->tone(),
            'status_reason' => $this->status_reason,
            'is_open' => $this->isOpen(),
            'allowed_transitions' => array_map(
                static fn ($s) => ['value' => $s->value, 'label' => $s->label()],
                $this->status->allowedTransitions(),
            ),

            'dispatch_region' => $this->whenLoaded('region', fn () => $this->region === null ? null : [
                'id' => $this->region->uuid,
                'code' => $this->region->code,
                'name' => $this->region->name,
                'warehouse_id' => $this->region->warehouse_id,
            ]),
            'warehouse_id' => $this->warehouse_id,

            'planned_at' => $this->planned_at?->toIso8601String(),
            'released_at' => $this->released_at?->toIso8601String(),
            'closed_at' => $this->closed_at?->toIso8601String(),

            'proposals' => DispatchProposalResource::collection($this->whenLoaded('proposals')),

            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
