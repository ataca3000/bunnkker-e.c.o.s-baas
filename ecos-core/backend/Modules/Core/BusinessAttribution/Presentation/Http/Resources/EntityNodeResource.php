<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Core\BusinessAttribution\Domain\Enums\NodeType;
use Modules\Core\BusinessAttribution\Domain\Models\EntityNode;

/** @mixin EntityNode */
class EntityNodeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $nodeType = $this->node_type instanceof NodeType
            ? $this->node_type
            : NodeType::from($this->node_type);

        return [
            'id' => $this->id,
            'node_type' => $nodeType->value,
            'node_label' => $nodeType->label(),
            'entity_id' => $this->entity_id,
            'entity_type' => $this->entity_type,
            'company_id' => $this->company_id,
            'label' => $this->label,
            'properties' => $this->properties,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
