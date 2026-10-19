<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TaskCommentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'          => $this->id,
            'task_id'     => $this->task_id,
            'body'        => $this->body,
            'is_system'   => $this->is_system,
            'is_internal' => $this->is_internal,
            'created_at'  => $this->created_at->toIsoString(),

            'author' => $this->whenLoaded('author', fn () => [
                'id'    => $this->author->id,
                'name'  => $this->author->name,
                'email' => $this->author->email,
            ]),
        ];
    }
}
