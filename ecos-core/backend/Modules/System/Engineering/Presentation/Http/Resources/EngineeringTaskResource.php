<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EngineeringTaskResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'               => $this->id,
            'title'            => $this->title,
            'description'      => $this->description,
            'status'           => $this->status->value,
            'status_label'     => $this->status->label(),
            'priority'         => $this->priority->value,
            'priority_label'   => $this->priority->label(),
            'source_type'      => $this->source_type,
            'source_ref'       => $this->source_ref,
            'assigned_agent_id' => $this->assigned_agent_id,
            'created_by_id'    => $this->created_by_id,
            'deadline'         => $this->deadline?->toIsoString(),
            'queued_at'        => $this->queued_at?->toIsoString(),
            'started_at'       => $this->started_at?->toIsoString(),
            'completed_at'     => $this->completed_at?->toIsoString(),
            'failed_at'        => $this->failed_at?->toIsoString(),
            'failure_reason'   => $this->failure_reason,
            'retry_count'      => $this->retry_count,
            'max_retries'      => $this->max_retries,
            'version'          => $this->version,
            'is_terminal'      => $this->isTerminal(),
            'is_blocked'       => false,
            'created_at'       => $this->created_at->toIsoString(),
            'updated_at'       => $this->updated_at->toIsoString(),

            'agent' => $this->whenLoaded('agent', fn () => [
                'id'     => $this->agent->id,
                'name'   => $this->agent->name,
                'status' => $this->agent->status->value,
            ]),

            'comments'    => TaskCommentResource::collection($this->whenLoaded('comments')),
            'attachments' => TaskAttachmentResource::collection($this->whenLoaded('attachments')),
            'dependencies' => TaskDependencyResource::collection($this->whenLoaded('dependencies')),
            'checklists'  => TaskChecklistResource::collection($this->whenLoaded('checklists')),

            'labels' => $this->whenLoaded('labels', fn () => $this->labels->map(fn ($l) => [
                'id'    => $l->id,
                'name'  => $l->name,
                'color' => $l->color,
            ])),

            'history'  => TaskHistoryResource::collection($this->whenLoaded('history')),
            'activity' => $this->whenLoaded('activity'),

            'checklist_progress' => $this->when(
                $this->relationLoaded('checklists'),
                $this->checklist_progress
            ),
        ];
    }
}
