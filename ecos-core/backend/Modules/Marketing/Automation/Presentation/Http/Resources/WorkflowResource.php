<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WorkflowResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'company_id' => $this->company_id,
            'brand_id' => $this->brand_id,
            'status' => $this->status->value,
            'trigger_type' => $this->trigger_type->value,
            'nodes_graph' => $this->nodes_graph,
            'version_number' => $this->version_number,
            'current_version_id' => $this->current_version_id,
            'governance_policy_id' => $this->governance_policy_id,
            'tags' => $this->tags,
            'execution_count' => $this->execution_count,
            'last_executed_at' => $this->last_executed_at,
            'activated_at' => $this->activated_at,
            'paused_at' => $this->paused_at,
            'archived_at' => $this->archived_at,
            'approval_status' => $this->approval_status,
            'approved_by' => $this->approved_by,
            'approved_at' => $this->approved_at,
            'created_by' => $this->created_by,
            'updated_by' => $this->updated_by,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'is_editable' => $this->isEditable(),
            'can_activate' => $this->status->canActivate(),
            'can_pause' => $this->status->canPause(),
            'can_archive' => $this->status->canArchive(),
            'active_executions' => $this->when($this->relationLoaded('executions'), fn () => $this->getActiveExecutionsCount()),
            'versions' => WorkflowVersionResource::collection($this->whenLoaded('versions')),
            'executions' => WorkflowExecutionResource::collection($this->whenLoaded('executions')),
            'event_subscriptions' => $this->whenLoaded('eventSubscriptions', fn () => $this->eventSubscriptions->map(fn ($s) => [
                'id' => $s->id,
                'event_type' => $s->event_type,
                'entity_type' => $s->entity_type,
                'is_active' => $s->is_active,
            ]),
            ),
        ];
    }
}
