<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class NotificationResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'          => $this->id,
            'pipeline_id' => $this->pipeline_id,
            'type'        => $this->type,
            'title'       => $this->title,
            'message'     => $this->message,
            'severity'    => $this->severity,
            'is_read'     => $this->is_read,
            'read_at'     => $this->read_at?->toISOString(),
            'metadata'    => $this->metadata,
            'created_at'  => $this->created_at->toISOString(),
        ];
    }
}
