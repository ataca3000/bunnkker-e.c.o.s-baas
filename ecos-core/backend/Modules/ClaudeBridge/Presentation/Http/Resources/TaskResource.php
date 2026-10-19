<?php

declare(strict_types=1);

namespace Modules\ClaudeBridge\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;
use Modules\ClaudeBridge\Domain\Models\Task;

/** @mixin Task */
final class TaskResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'description' => $this->description,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'priority' => $this->priority->value,
            'repository_path' => $this->repository_path,
            'target_branch' => $this->target_branch,
            'worker' => $this->whenLoaded('worker', fn () => [
                'id' => $this->worker->id,
                'name' => $this->worker->name,
            ]),
            'current_execution' => $this->whenLoaded('latestExecution', fn () => $this->latestExecution ? [
                'id' => $this->latestExecution->id,
                'attempt_number' => $this->latestExecution->attempt_number,
                'started_at' => $this->latestExecution->started_at?->toISOString(),
                'finished_at' => $this->latestExecution->finished_at?->toISOString(),
                'duration_seconds' => $this->latestExecution->duration_seconds,
                'tokens_used' => $this->latestExecution->tokens_used,
                'claude_version' => $this->latestExecution->claude_version,
                'failure_code' => $this->latestExecution->failure_code,
            ] : null),
            'artifacts' => $this->whenLoaded('artifacts', fn () => $this->artifacts->map(fn ($a) => [
                'id' => $a->id,
                'type' => $a->type->value,
                'filename' => $a->filename,
                'size_bytes' => $a->size_bytes,
            ])),
            'failure_reason' => $this->failure_reason,
            'review_comment' => $this->review_comment,
            'reviewed_by' => $this->reviewed_by,
            'reviewed_at' => $this->reviewed_at?->toISOString(),
            'cancelled_at' => $this->cancelled_at?->toISOString(),
            'created_at' => $this->created_at->toISOString(),
            'updated_at' => $this->updated_at->toISOString(),
        ];
    }
}
