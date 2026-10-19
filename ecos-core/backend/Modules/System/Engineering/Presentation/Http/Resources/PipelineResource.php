<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class PipelineResource extends JsonResource
{
    public function toArray($request): array
    {
        $data = [
            'id'               => $this->id,
            'task_name'        => $this->task_name,
            'branch'           => $this->branch,
            'commit_sha'       => $this->commit_sha,
            'status'           => $this->status,
            'current_stage'    => $this->current_stage,
            'current_stage_label' => $this->current_stage
                ? (\Modules\System\Engineering\Domain\Enums\PipelineStage::tryFrom($this->current_stage)?->label() ?? $this->current_stage)
                : null,
            'template_slug'    => $this->template_slug,
            'started_at'       => $this->started_at?->toISOString(),
            'finished_at'      => $this->finished_at?->toISOString(),
            'duration_seconds' => $this->duration_seconds,
            'duration_formatted' => $this->durationFormatted(),
            'initiated_by'     => $this->initiated_by,
            'error_message'    => $this->error_message,
            'auto_deploy'      => $this->auto_deploy,
        ];

        // Include logs when loaded
        if ($this->relationLoaded('logs')) {
            $data['logs'] = PipelineLogResource::collection($this->logs);
        }

        return $data;
    }
}
