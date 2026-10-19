<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TaskAttachmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                => $this->id,
            'task_id'           => $this->task_id,
            'filename'          => $this->filename,
            'original_filename' => $this->original_filename,
            'content_type'      => $this->content_type,
            'size_bytes'        => $this->size_bytes,
            'download_url'      => $this->download_url,
            'created_at'        => $this->created_at->toIsoString(),

            'uploaded_by' => $this->whenLoaded('uploadedBy', fn () => [
                'id'   => $this->uploadedBy->id,
                'name' => $this->uploadedBy->name,
            ]),
        ];
    }
}
