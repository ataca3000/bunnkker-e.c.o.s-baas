<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TaskDependencyResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                  => $this->id,
            'task_id'             => $this->task_id,
            'depends_on_task_id'  => $this->depends_on_task_id,
            'dependency_type'     => $this->dependency_type,
            'created_at'          => $this->created_at->toIsoString(),

            'depends_on_task' => $this->whenLoaded('dependsOnTask', fn () => [
                'id'       => $this->dependsOnTask->id,
                'title'    => $this->dependsOnTask->title,
                'status'   => $this->dependsOnTask->status->value,
                'priority' => $this->dependsOnTask->priority->value,
            ]),
        ];
    }
}
