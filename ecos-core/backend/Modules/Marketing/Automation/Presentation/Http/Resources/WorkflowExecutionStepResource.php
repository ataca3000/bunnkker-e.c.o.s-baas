<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WorkflowExecutionStepResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'execution_id' => $this->execution_id,
            'node_id' => $this->node_id,
            'node_type' => $this->node_type,
            'action_type' => $this->action_type,
            'status' => $this->status,
            'input' => $this->input,
            'output' => $this->output,
            'error' => $this->error,
            'duration_ms' => $this->duration_ms,
            'executed_at' => $this->executed_at,
        ];
    }
}
