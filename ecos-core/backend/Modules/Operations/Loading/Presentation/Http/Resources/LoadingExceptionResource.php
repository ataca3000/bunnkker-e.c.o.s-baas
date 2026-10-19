<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Presentation\Http\Resources;

use BackedEnum;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class LoadingExceptionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'exception_type' => $this->exception_type,
            'severity' => $this->severity instanceof BackedEnum ? $this->severity->value : $this->severity,
            'status' => $this->status instanceof BackedEnum ? $this->status->value : $this->status,
            'description' => $this->description,
            'entity_type' => $this->entity_type,
            'entity_id' => $this->entity_id,
            'resolved_at' => $this->resolved_at?->toIso8601String(),
            'resolution_notes' => $this->resolution_notes,
            'escalated_at' => $this->escalated_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'created_by' => $this->created_by,
        ];
    }
}
