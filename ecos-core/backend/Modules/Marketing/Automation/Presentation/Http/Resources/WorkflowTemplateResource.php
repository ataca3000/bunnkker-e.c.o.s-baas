<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WorkflowTemplateResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'category' => $this->category->value,
            'trigger_type' => $this->trigger_type->value,
            'nodes_graph' => $this->nodes_graph,
            'company_id' => $this->company_id,
            'is_global' => $this->is_global,
            'is_active' => $this->is_active,
            'usage_count' => $this->usage_count,
            'created_by' => $this->created_by,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
