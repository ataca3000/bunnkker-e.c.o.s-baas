<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EngineeringReleaseCandidateResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'               => $this->id,
            'title'            => $this->title,
            'description'      => $this->description,
            'status'           => $this->status->value,
            'status_label'     => $this->status->label(),
            'version_tag'      => $this->version_tag,
            'created_by_id'    => $this->created_by_id,
            'approved_at'      => $this->approved_at?->toIsoString(),
            'released_at'      => $this->released_at?->toIsoString(),
            'rejection_reason' => $this->rejection_reason,
            'task_count'       => $this->task_count,
            'created_at'       => $this->created_at->toIsoString(),

            'tasks' => $this->whenLoaded('tasks', fn () => $this->tasks->map(fn ($task) => [
                'id'       => $task->id,
                'title'    => $task->title,
                'status'   => $task->status->value,
                'priority' => $task->priority->value,
            ])),
        ];
    }
}
