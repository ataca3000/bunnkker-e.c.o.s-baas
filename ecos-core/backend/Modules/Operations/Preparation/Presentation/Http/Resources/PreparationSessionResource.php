<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Operations\Preparation\Domain\Models\PreparationSession;

/**
 * @mixin PreparationSession
 */
final class PreparationSessionResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'company_id' => $this->company_id,
            'warehouse_id' => $this->warehouse_id,
            'session_number' => $this->session_number,
            'planning_date' => $this->planning_date?->toDateString(),
            'status' => $this->status->value,
            'operator_id' => $this->operator_id,
            'supervisor_id' => $this->supervisor_id,
            'waves_count' => $this->waves_count,
            'products_count' => $this->products_count,
            'orders_count' => $this->orders_count ?? 0,
            'total_units_required' => $this->total_units_required,
            'total_units_prepared' => $this->total_units_prepared,
            'completion_pct' => $this->completionPct(),
            'auto_created' => (bool) ($this->auto_created ?? false),
            'policy_id' => $this->policy_id,
            'notes' => $this->notes,
            'started_at' => $this->started_at?->toIso8601String(),
            'started_by' => $this->started_by,
            'planned_at' => $this->planned_at?->toIso8601String(),
            'planned_by' => $this->planned_by,
            'approved_at' => $this->approved_at?->toIso8601String(),
            'approved_by' => $this->approved_by,
            'frozen_at' => $this->frozen_at?->toIso8601String(),
            'frozen_by' => $this->frozen_by,
            'closed_at' => $this->closed_at?->toIso8601String(),
            'closed_by' => $this->closed_by,
            'paused_at' => $this->paused_at?->toIso8601String(),
            'completed_at' => $this->completed_at?->toIso8601String(),
            'cancelled_at' => $this->cancelled_at?->toIso8601String(),
            'cancellation_reason' => $this->cancellation_reason,
            'created_at' => $this->created_at->toIso8601String(),
            'updated_at' => $this->updated_at->toIso8601String(),
            'waves' => $this->whenLoaded('waves', fn () => PreparationWaveResource::collection($this->waves),
            ),
        ];
    }
}
