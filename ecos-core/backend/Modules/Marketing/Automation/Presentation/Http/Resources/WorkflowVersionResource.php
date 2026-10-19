<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WorkflowVersionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'workflow_id' => $this->workflow_id,
            'version_number' => $this->version_number,
            'trigger_type' => $this->trigger_type,
            'nodes_graph' => $this->nodes_graph,
            'change_note' => $this->change_note,
            'changed_by' => $this->changed_by,
            'created_at' => $this->created_at,
        ];
    }
}
