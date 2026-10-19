<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WorkflowExecutionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'workflow_id' => $this->workflow_id,
            'workflow_version_id' => $this->workflow_version_id,
            'entity_type' => $this->entity_type,
            'entity_id' => $this->entity_id,
            'status' => $this->status->value,
            'trigger_type' => $this->trigger_type,
            'trigger_payload' => $this->trigger_payload,
            'current_node_id' => $this->current_node_id,
            'step_count' => $this->step_count,
            'triggered_by' => $this->triggered_by,
            'started_at' => $this->started_at,
            'completed_at' => $this->completed_at,
            'failed_at' => $this->failed_at,
            'error_message' => $this->error_message,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'can_retry' => $this->canRetry(),
            'steps' => WorkflowExecutionStepResource::collection($this->whenLoaded('steps')),
        ];
    }
}
